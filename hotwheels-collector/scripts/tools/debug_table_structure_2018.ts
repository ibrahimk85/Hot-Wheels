/**
 * Debug script to analyze table structure for 2018 Team Transport
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

  const table = tables.first();
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3;
  });

  console.log(`First table has ${rows.length} data rows\n`);

  // Analyze first few rows
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    console.log(`\n=== Row ${i} ===`);
    console.log(`Total cells: ${cells.length}`);
    
    cells.each((idx, cell) => {
      const cellText = $(cell).text().trim().substring(0, 50);
      const imgs = $(cell).find('img');
      const links = $(cell).find('a');
      
      console.log(`  Cell ${idx}: "${cellText}" (${imgs.length} img(s), ${links.length} link(s))`);
      
      if (imgs.length > 0) {
        imgs.each((imgIdx, img) => {
          const src = $(img).attr('src') || $(img).attr('data-src') || 'no src';
          console.log(`    Image ${imgIdx + 1}: ${src.substring(0, 80)}...`);
        });
      }
    });
  }
}

main().catch(console.error);


