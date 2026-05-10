import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/List_of_2023_Hot_Wheels';

async function main() {
  console.log('Fetching 2023 mainline data to analyze table structure...\n');
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
  console.log(`Found ${rows.length} rows.\n`);

  // Show first 10 rows with their structure
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue; // skip header or empty rows

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = $(cells[1]).text().trim();
    const modelNameRaw = $(cells[2]).text().trim();
    const subSeriesNameRaw = $(cells[3]).text().trim();
    const seriesInfoRaw = $(cells[4] || cells[cells.length - 1]).text().trim();
    
    // Check for image in last cell
    const imgElement = $(cells[cells.length - 1]).find('img');
    const imgUrl = imgElement.attr('data-src') || imgElement.attr('src') || 'No image';

    console.log(`Row ${i + 1}:`);
    console.log(`  Toy#: ${toyNumber}`);
    console.log(`  COL#: ${collectorNumberStr}`);
    console.log(`  Model: ${modelNameRaw}`);
    console.log(`  SubSeries: "${subSeriesNameRaw}"`);
    console.log(`  Series Info: "${seriesInfoRaw}"`);
    console.log(`  Image: ${imgUrl.substring(0, 80)}...`);
    console.log(`  Cells count: ${cells.length}`);
    console.log('');
  }

  // Check for TH/STH in first few rows
  console.log('\n=== Checking for TH/STH patterns ===\n');
  let thCount = 0;
  let sthCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    const subSeriesNameRaw = $(cells[3]).text().trim();
    const seriesInfoRaw = $(cells[4] || cells[cells.length - 1]).text().trim();
    const allTextForTH = subSeriesNameRaw + ' ' + seriesInfoRaw;
    
    const isTreasureHunt = (/Treasure Hunt/i.test(allTextForTH) || /Treasure Hunt/i.test(subSeriesNameRaw)) && !(/Super Treasure Hunt/i.test(allTextForTH) || /Super Treasure Hunt/i.test(subSeriesNameRaw));
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(allTextForTH) || /Super Treasure Hunt/i.test(subSeriesNameRaw);

    if (isTreasureHunt) thCount++;
    if (isSuperTreasureHunt) sthCount++;
  }

  console.log(`TH count: ${thCount}`);
  console.log(`STH count: ${sthCount}`);
}

main().catch(console.error);








