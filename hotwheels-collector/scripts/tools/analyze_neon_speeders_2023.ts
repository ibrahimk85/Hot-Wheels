/**
 * Script to analyze Neon Speeders 2023 wiki page structure
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      if (html.includes('Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page');
      }

      console.log(`Successfully fetched (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt < retries) {
        await sleep(delay);
        delay *= 1.5;
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

async function main() {
  const year = 2023;
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Neon_Speeders_Series_(${year})`;

  console.log(`Analyzing ${wikiUrl}\n`);

  const html = await fetchWithRetry(wikiUrl);
  const $ = cheerio.load(html);

  // Find all tables
  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s) with class 'wikitable'\n`);

  // Find heading "2023" - we want the table after this heading
  const heading2023 = $('h2, h3, h4').filter((_, el) => {
    return $(el).text().trim().includes('2023');
  }).first();

  console.log(`Found heading for 2023: "${heading2023.text().trim()}"`);
  console.log(`Heading level: ${heading2023.prop('tagName')}\n`);

  // Find the table immediately after the 2023 heading
  let targetTable = heading2023.nextUntil('h2, h3, h4').filter('table.wikitable').first();
  
  if (targetTable.length === 0) {
    // Try finding table after the heading in different ways
    targetTable = heading2023.next('table.wikitable').first();
  }

  if (targetTable.length === 0) {
    console.log('Could not find table directly after 2023 heading. Analyzing all tables...\n');
    targetTable = tables.first(); // Use first table as fallback
  }

  console.log(`Target table found: ${targetTable.length > 0 ? 'Yes' : 'No'}\n`);

  if (targetTable.length > 0) {
    const table = targetTable;
    
    // Get header row to understand column structure
    const headerRow = table.find('thead tr, tbody tr').first();
    const headerCells = headerRow.find('th, td');
    console.log(`Table header has ${headerCells.length} columns:`);
    headerCells.each((idx, cell) => {
      const text = $(cell).text().trim();
      console.log(`  Column ${idx}: "${text}"`);
    });

    // Get data rows
    const rows = table.find('tbody tr').filter((_, row) => {
      const cells = $(row).find('td');
      return cells.length > 0;
    });

    console.log(`\nFound ${rows.length} data rows\n`);

    // Analyze first row in detail
    if (rows.length > 0) {
      const firstRow = rows.first();
      const cells = firstRow.find('td');
      console.log(`First row analysis (${cells.length} cells):`);
      
      cells.each((idx, cell) => {
        const text = $(cell).text().trim();
        const hasImg = $(cell).find('img').length > 0;
        const imgCount = $(cell).find('img').length;
        console.log(`  Column ${idx}: "${text.substring(0, 50)}" ${hasImg ? `[${imgCount} image(s)]` : '[no image]'}`);
        
        if (hasImg) {
          $(cell).find('img').each((imgIdx, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src') || 'no src';
            console.log(`    Image ${imgIdx + 1}: ${src.substring(0, 80)}...`);
          });
        }
      });
    }

    // Analyze all rows to find card numbers
    console.log(`\nAll rows card numbers:`);
    rows.each((rowIdx, row) => {
      const cells = $(row).find('td');
      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : '';
      
      // Try to extract card number
      const cardMatch = cell1.match(/([A-Z]{3}\d{2,3})/);
      const cardNumber = cardMatch ? cardMatch[1] : 'NOT FOUND';
      console.log(`  Row ${rowIdx + 1}: "${cell0}" | "${cell1.substring(0, 40)}" | Card#: ${cardNumber}`);
    });
  }

  // Save HTML for inspection
  const debugDir = path.join(process.cwd(), 'debug');
  await fs.promises.mkdir(debugDir, { recursive: true });
  const debugFile = path.join(debugDir, `neon_speeders_2023_analysis_${Date.now()}.html`);
  await fs.promises.writeFile(debugFile, html, 'utf8');
  console.log(`\nHTML saved to: ${debugFile}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
