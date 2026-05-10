/**
 * Debug script to analyze the exact table structure for 2018 Team Transport
 * Specifically looking at Mix 1, Toy# FLF61, Series# 1
 */

import * as cheerio from 'cheerio';

const TEAM_TRANSPORT_URL = 'https://hotwheels.fandom.com/wiki/2018_Car_Culture:_Team_Transport';

async function main() {
  console.log('Fetching 2018 Team Transport page…');
  const resp = await fetch(TEAM_TRANSPORT_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch: ${resp.status}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s)\n`);

  // Find Mix 1 table
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    
    // Try to find Mix 1
    const prevHeading = $(table).prevAll('h2, h3, h4').first();
    const headingText = prevHeading.text().trim();
    
    console.log(`Table ${tableIdx}: "${headingText}"`);
    
    if (!headingText.toLowerCase().includes('mix 1')) {
      continue;
    }

    console.log(`=== MIX 1 TABLE ===\n`);

    // Print header row
    const headerRow = $(table).find('thead tr, tbody tr').first();
    const headerCells = headerRow.find('th, td');
    console.log('HEADER ROW:');
    headerCells.each((idx, cell) => {
      const text = $(cell).text().trim();
      console.log(`  Column ${idx}: "${text}"`);
    });
    console.log('');

    // Get all rows
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Found ${rows.length} data rows\n`);

    // Find FLF61 rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      const firstCell = $(cells[0]).text().trim();
      
      // Check if this is FLF61
      if (firstCell === 'FLF61' || firstCell.includes('FLF61')) {
        console.log(`=== ROW ${i} (FLF61) ===`);
        console.log(`Number of cells: ${cells.length}`);
        console.log('');
        
        cells.each((idx, cell) => {
          const text = $(cell).text().trim();
          const hasImage = $(cell).find('img').length > 0;
          const imgCount = $(cell).find('img').length;
          
          console.log(`Column ${idx}:`);
          console.log(`  Text: "${text.substring(0, 100)}"`);
          console.log(`  Has images: ${hasImage} (${imgCount} image(s))`);
          
          if (hasImage) {
            $(cell).find('img').each((imgIdx, img) => {
              let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
              if (imgUrl) {
                if (imgUrl.startsWith('//')) {
                  imgUrl = 'https:' + imgUrl;
                }
                console.log(`    Image ${imgIdx + 1}: ${imgUrl.substring(0, 100)}...`);
              }
            });
          }
          console.log('');
        });
        console.log('---\n');
      }
      
      // Also check the next row (car row) if this is transport row
      if (i < rows.length - 1 && firstCell === 'FLF61') {
        const nextRow = rows[i + 1];
        const nextCells = $(nextRow).find('td');
        const nextFirstCell = $(nextCells[0]).text().trim();
        
        // If next row doesn't start with Toy#, it's likely a car row
        if (!/^[A-Z0-9]{3,8}$/i.test(nextFirstCell) || nextFirstCell.includes(' ')) {
          console.log(`=== ROW ${i + 1} (Car row for FLF61) ===`);
          console.log(`Number of cells: ${nextCells.length}`);
          console.log('');
          
          nextCells.each((idx, cell) => {
            const text = $(cell).text().trim();
            const hasImage = $(cell).find('img').length > 0;
            const imgCount = $(cell).find('img').length;
            
            console.log(`Column ${idx}:`);
            console.log(`  Text: "${text.substring(0, 100)}"`);
            console.log(`  Has images: ${hasImage} (${imgCount} image(s))`);
            
            if (hasImage) {
              $(cell).find('img').each((imgIdx, img) => {
                let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
                if (imgUrl) {
                  if (imgUrl.startsWith('//')) {
                    imgUrl = 'https:' + imgUrl;
                  }
                  console.log(`    Image ${imgIdx + 1}: ${imgUrl.substring(0, 100)}...`);
                }
              });
            }
            console.log('');
          });
          console.log('---\n');
        }
      }
    }
  }
}

main().catch(console.error);


