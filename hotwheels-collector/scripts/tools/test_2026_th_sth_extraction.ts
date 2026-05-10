import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/List_of_2026_Hot_Wheels';

async function main() {
  console.log('Fetching 2026 mainline data to check TH/STH extraction...\n');
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Locate the table containing the list
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the mainline table on the page');
  }

  // Iterate over each row of the table body
  const rows = table.find('tbody tr');
  console.log(`Found ${rows.length} rows. Checking for TH/STH...\n`);

  let thCount = 0;
  let sthCount = 0;
  const thExamples: string[] = [];
  const sthExamples: string[] = [];

  // First, check the header to see all columns
  const headerRow = table.find('thead tr');
  if (headerRow.length > 0) {
    const headerCells = $(headerRow[0]).find('th, td');
    console.log('Table headers:');
    headerCells.each((i, cell) => {
      console.log(`  Column ${i}: ${$(cell).text().trim()}`);
    });
    console.log('\n');
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue; // skip header or empty rows

    // Log all cells for first few rows to see structure
    if (i < 5) {
      console.log(`Row ${i + 1} - All cells:`);
      cells.each((idx, cell) => {
        const text = $(cell).text().trim();
        const html = $(cell).html() || '';
        console.log(`  Cell ${idx}: "${text}" (HTML contains: ${html.substring(0, 100)})`);
      });
      console.log('');
    }

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = $(cells[1]).text().trim();
    const modelNameRaw = $(cells[2]).text().trim();
    const subSeriesName = $(cells[3]).text().trim();
    const seriesInfoRaw = $(cells[4] || cells[cells.length - 1]).text().trim();

    // Get all text from all cells to check for TH/STH anywhere
    let allText = '';
    cells.each((idx, cell) => {
      allText += ' ' + $(cell).text().trim();
    });
    allText = allText.trim();

    // Extract flags from seriesInfo and all text
    const isTreasureHunt = (/Treasure Hunt/i.test(seriesInfoRaw) || /Treasure Hunt/i.test(allText) || /Treasure Hunt/i.test(subSeriesName)) && !(/Super Treasure Hunt/i.test(seriesInfoRaw) || /Super Treasure Hunt/i.test(allText) || /Super Treasure Hunt/i.test(subSeriesName));
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(seriesInfoRaw) || /Super Treasure Hunt/i.test(allText) || /Super Treasure Hunt/i.test(subSeriesName);

    if (isTreasureHunt) {
      thCount++;
      if (thExamples.length < 5) {
        thExamples.push(`${modelNameRaw} (COL#${collectorNumberStr}, Toy#${toyNumber}) - SubSeries: "${subSeriesName}" - Series Info: "${seriesInfoRaw}" - All Text: "${allText.substring(0, 200)}"`);
      }
    }

    if (isSuperTreasureHunt) {
      sthCount++;
      if (sthExamples.length < 5) {
        sthExamples.push(`${modelNameRaw} (COL#${collectorNumberStr}, Toy#${toyNumber}) - SubSeries: "${subSeriesName}" - Series Info: "${seriesInfoRaw}" - All Text: "${allText.substring(0, 200)}"`);
      }
    }

    // Show first 10 rows with their seriesInfo for debugging
    if (i < 10) {
      console.log(`Row ${i + 1}: ${modelNameRaw} - Series Info: "${seriesInfoRaw}"`);
      console.log(`  TH: ${isTreasureHunt}, STH: ${isSuperTreasureHunt}\n`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`TH count: ${thCount}`);
  console.log(`STH count: ${sthCount}\n`);

  if (thExamples.length > 0) {
    console.log('TH Examples:');
    thExamples.forEach((ex) => console.log(`  - ${ex}`));
  }

  if (sthExamples.length > 0) {
    console.log('\nSTH Examples:');
    sthExamples.forEach((ex) => console.log(`  - ${ex}`));
  }

  // Also check for any rows that might have TH/STH in different formats
  console.log('\n\nChecking for alternative TH/STH formats...');
  let altThCount = 0;
  let altSthCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    const seriesInfoRaw = $(cells[4]).text().trim();
    const modelNameRaw = $(cells[2]).text().trim();

    // Check for various TH/STH patterns
    if (/TH/i.test(seriesInfoRaw) && !/STH/i.test(seriesInfoRaw) && !/Treasure Hunt/i.test(seriesInfoRaw)) {
      altThCount++;
      if (altThCount <= 3) {
        console.log(`  Found "TH" pattern: ${modelNameRaw} - "${seriesInfoRaw}"`);
      }
    }
    if (/STH/i.test(seriesInfoRaw) && !/Super Treasure Hunt/i.test(seriesInfoRaw)) {
      altSthCount++;
      if (altSthCount <= 3) {
        console.log(`  Found "STH" pattern: ${modelNameRaw} - "${seriesInfoRaw}"`);
      }
    }
  }

  if (altThCount > 0 || altSthCount > 0) {
    console.log(`\nAlternative patterns found: TH=${altThCount}, STH=${altSthCount}`);
  }
}

main().catch(console.error);

