/**
 * Script to analyze Neon Speeders 2025 wiki page structure
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
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Neon_Speeders_Series_(2023)`;

  console.log(`Analyzing 2025 section in ${wikiUrl}\n`);

  const html = await fetchWithRetry(wikiUrl);
  const $ = cheerio.load(html);

  // Find heading "2025"
  const heading2025 = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes('2025') && !text.includes('2024') && !text.includes('2023');
  }).first();

  console.log(`Found heading for 2025: "${heading2025.text().trim()}"`);
  console.log(`Heading level: ${heading2025.prop('tagName')}\n`);

  // Find all tables after 2025 heading until next year heading
  const nextYearHeading = heading2025.nextAll('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return /^\d{4}/.test(text) && !text.includes('2025');
  }).first();

  let tablesToCheck;
  if (nextYearHeading.length > 0) {
    tablesToCheck = heading2025.nextUntil(nextYearHeading).filter('table.wikitable');
  } else {
    tablesToCheck = heading2025.nextAll('table.wikitable');
  }

  console.log(`Found ${tablesToCheck.length} table(s) for 2025\n`);

  // Analyze each table
  tablesToCheck.each((tableIndex, tableEl) => {
    const table = $(tableEl);
    
    // Try to find sub-series name (Mix 1, Mix 2, etc.)
    const prevHeading = table.prevAll('h2, h3, h4, h5').first();
    const subSeriesName = prevHeading.length > 0 ? prevHeading.text().trim() : `Table ${tableIndex + 1}`;
    
    console.log(`\n=== Table ${tableIndex + 1}: ${subSeriesName} ===`);
    
    // Get header row
    const headerRow = table.find('thead tr, tbody tr').first();
    const headerCells = headerRow.find('th, td');
    console.log(`Columns: ${headerCells.length}`);
    headerCells.each((idx, cell) => {
      const text = $(cell).text().trim();
      console.log(`  Column ${idx}: "${text}"`);
    });

    // Get data rows
    const rows = table.find('tbody tr').filter((_, row) => {
      const cells = $(row).find('td');
      return cells.length > 0;
    });

    console.log(`Data rows: ${rows.length}`);

    // Show first row card numbers
    if (rows.length > 0) {
      const firstRow = rows.first();
      const cells = firstRow.find('td');
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : '';
      const cardMatch = cell1.match(/([A-Z]{3}\d{2,3})/);
      console.log(`First row: Card#: ${cardMatch ? cardMatch[1] : 'NOT FOUND'}, Casting: ${cell2.substring(0, 40)}`);
    }
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
