import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/List_of_2025_Hot_Wheels';

async function main() {
  console.log('Fetching 2025 mainline data to check TH/STH extraction...\n');
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue; // skip header or empty rows

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = $(cells[1]).text().trim();
    const modelNameRaw = $(cells[2]).text().trim();
    const subSeriesNameRaw = $(cells[3]).text().trim();
    const seriesInfoRaw = $(cells[4] || cells[cells.length - 1]).text().trim();

    // Get all text from all cells to check for TH/STH anywhere
    let allText = '';
    cells.each((idx, cell) => {
      allText += ' ' + $(cell).text().trim();
    });
    allText = allText.trim();

    // Extract flags from seriesInfo and all text
    const allTextForTH = subSeriesNameRaw + ' ' + seriesInfoRaw;
    const isTreasureHunt = (/Treasure Hunt/i.test(allTextForTH) || /Treasure Hunt/i.test(subSeriesNameRaw)) && !(/Super Treasure Hunt/i.test(allTextForTH) || /Super Treasure Hunt/i.test(subSeriesNameRaw));
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(allTextForTH) || /Super Treasure Hunt/i.test(subSeriesNameRaw);

    if (isTreasureHunt) {
      thCount++;
      if (thExamples.length < 5) {
        thExamples.push(`${modelNameRaw} (COL#${collectorNumberStr}, Toy#${toyNumber}) - SubSeries: "${subSeriesNameRaw}" - Series Info: "${seriesInfoRaw}"`);
      }
    }

    if (isSuperTreasureHunt) {
      sthCount++;
      if (sthExamples.length < 5) {
        sthExamples.push(`${modelNameRaw} (COL#${collectorNumberStr}, Toy#${toyNumber}) - SubSeries: "${subSeriesNameRaw}" - Series Info: "${seriesInfoRaw}"`);
      }
    }

    // Show first 5 rows with their seriesInfo for debugging
    if (i < 5) {
      console.log(`Row ${i + 1}: ${modelNameRaw} - SubSeries: "${subSeriesNameRaw}" - Series Info: "${seriesInfoRaw}"`);
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
}

main().catch(console.error);
