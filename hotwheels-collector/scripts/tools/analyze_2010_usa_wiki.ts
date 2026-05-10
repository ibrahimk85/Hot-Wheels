/**
 * Script to analyze 2010 USA wiki page structure
 * Check how 2nd Color and 3rd Color variants are represented
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/List_of_2010_Hot_Wheels';

async function main() {
  console.log('Fetching 2010 USA mainline page…');
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find ALL tables on the page
  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page\n`);

  // Analyze first few tables to understand structure
  let sampleCount = 0;
  const maxSamples = 3;

  allTables.each((index, tableElement) => {
    if (sampleCount >= maxSamples) return;
    
    const $table = $(tableElement);
    const rows = $table.find('tbody tr, tr');
    
    if (rows.length < 2) return; // Skip empty tables
    
    console.log(`\n=== Table ${index + 1} ===`);
    console.log(`Rows: ${rows.length}\n`);
    
    // Get header row
    const headerRow = rows.eq(0);
    const headerCells = headerRow.find('th, td');
    console.log('Headers:');
    headerCells.each((i, cell) => {
      console.log(`  Column ${i}: ${$(cell).text().trim()}`);
    });
    
    // Analyze first 5 data rows
    console.log('\nSample rows (first 5):');
    for (let i = 1; i < Math.min(6, rows.length); i++) {
      const row = rows.eq(i);
      const cells = row.find('td');
      
      if (cells.length === 0) continue;
      
      const toyNumber = $(cells[0]).text().trim();
      const collectorNumber = $(cells[1]).text().trim();
      const modelName = $(cells[2]).text().trim();
      const series = $(cells[3]).text().trim();
      
      console.log(`\nRow ${i}:`);
      console.log(`  Toy#: ${toyNumber}`);
      console.log(`  COL#: ${collectorNumber}`);
      console.log(`  Model Name: ${modelName}`);
      console.log(`  Series: ${series}`);
      
      // Check if model name contains color info
      if (modelName.includes('2nd Color') || modelName.includes('3rd Color')) {
        console.log(`  ⚠️  Contains color variant info!`);
      }
      
      // Check if there are more columns
      if (cells.length > 4) {
        console.log(`  Additional columns: ${cells.length - 4}`);
        for (let j = 4; j < cells.length; j++) {
          console.log(`    Column ${j}: ${$(cells[j]).text().trim().substring(0, 50)}`);
        }
      }
    }
    
    sampleCount++;
  });
}

main()
  .catch((e) => {
    console.error(e);
  });
