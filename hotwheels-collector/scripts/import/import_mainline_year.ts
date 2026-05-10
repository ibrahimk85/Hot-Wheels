/**
 * Generic script to import Hot Wheels Mainline sets for any year (2000-2026) into your database using Prisma.
 *
 * This script fetches the mainline table from the Hot Wheels Fandom wiki for a specified year,
 * parses each row to extract the toy number, collector number, model name, sub-series,
 * series info (e.g. New for [YEAR]!, Treasure Hunt, Super Treasure Hunt, exclusives),
 * and then writes the data into the corresponding Prisma models: Year → Collection → SubSeries → Model → Variant.
 *
 * WARNING: This script only reads $('table').first() on each wiki page. Years whose lists use
 * multiple tables (e.g. 2009, 2010 USA/International, 2011–2012) will be INCOMPLETE if you run
 * import_mainline_year.ts for those years. Use the dedicated scripts instead
 * (e.g. import_2009_mainline.ts, import_2010_usa_mainline.ts, import_2011_mainline.ts).
 *
 * How to use:
 *
 *   1. Install the cheerio package (used for HTML parsing) and ts-node
 *      (to run TypeScript files directly):
 *
 *         npm install cheerio
 *         npm install -D ts-node typescript
 *
 *   2. Ensure your Prisma schema has been migrated and that the database
 *      connection details are configured in your `.env` file.
 *
 *   3. Run the script with ts-node, providing the year as an argument:
 *
 *         npx ts-node scripts/import/import_mainline_year.ts 2025
 *
 * Notes:
 *   - The script is idempotent regarding the `Year`, `Collection`, and
 *     `SubSeries` creation and checks for existing models and variants to avoid duplicates.
 *   - Because the Fandom wiki does not assign new collector numbers to
 *     color variations, multiple variants will share the same collector
 *     number but have unique toy numbers. This script uses the first
 *     occurrence of a collector number to create the `Model` and then
 *     associates subsequent rows with the same collector number as
 *     additional `Variant` records.
 *   - Column mappings are configured per year range to handle different table structures.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { getMainlineWikiUrlForYear } from '../lib/mainline-urls.ts';

// Node 18 includes a global fetch implementation. If you are on an older
// Node version you may need to install node-fetch and import it here.

// Instantiate Prisma client
const prisma = new PrismaClient();

// Helper function to pause execution for debugging or rate‑limiting
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Column mapping interface
interface ColumnMap {
  toy: number;        // Toy# or # column
  collector: number;  // Col.# column
  name: number;       // Name column
  series: number;     // Series column
  seriesInfo: number; // Series# or Note/Ratio column
  photo: number;      // Photo column
}

// Column mapping configuration by year
// Most years use the same structure, but we define ranges for clarity
const columnMapByYear: Record<number, ColumnMap> = {
  // 2016-2026: Toy#, Col.#, Name, Series, Series#, Photo
  2016: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2017: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2018: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2019: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2020: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2021: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2022: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2023: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2024: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2025: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2026: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  // 2013-2015: Toy#, Col.#, Name, Series, Note/Ratio, Photo
  2013: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2014: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2015: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  // 2012 and earlier: #, Col.#, Name, Series, #, Photo
  2012: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2011: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2010: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2009: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2008: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2007: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2006: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2005: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2004: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2003: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2002: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2001: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2000: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
};

/**
 * Get column mapping for a given year
 */
function getColumnMap(year: number): ColumnMap {
  return columnMapByYear[year] ?? columnMapByYear[2016]; // Default to 2016 structure
}

// Main execution function
async function main() {
  // Get year from command line argument
  const yearArg = process.argv[2];
  if (!yearArg) {
    console.error('Please provide a year as an argument: npx ts-node scripts/import/import_mainline_year.ts 2025');
    process.exit(1);
  }
  
  const targetYear = parseInt(yearArg, 10);
  if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2026) {
    console.error('Year must be a number between 2000 and 2026');
    process.exit(1);
  }

  const url = getMainlineWikiUrlForYear(targetYear);
  console.log(`Fetching ${targetYear} mainline data from ${url}…`);

  const html = await fetchFandomWikiHtml(url);
  const $ = cheerio.load(html);

  // Locate the table containing the list
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the mainline table on the page');
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  // Ensure the Collection record exists for "Mainline"
  const collectionName = 'Mainline';
  let collectionRecord = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: collectionName,
        code: collectionName,
        year: {
          connect: { id: yearRecord.id },
        },
      },
    });
    console.log(`Created Collection record for ${collectionName}`);
  }

  // Get column mapping for this year
  const columnMap = getColumnMap(targetYear);

  // In‑memory caches to avoid redundant lookups/creates
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>(); // keyed by collector number

  // Iterate over each row of the table body
  const rows = table.find('tbody tr');
  console.log(`Found ${rows.length} rows. Processing…`);

  let createdCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue; // skip header or empty rows

    // Extract data using column mapping
    const toyNumber = $(cells[columnMap.toy]).text().trim();
    const collectorNumberStr = $(cells[columnMap.collector]).text().trim();
    const collectorNumber = collectorNumberStr === '' ? null : parseInt(collectorNumberStr, 10);
    const modelNameRaw = $(cells[columnMap.name]).text().trim();
    const subSeriesName = $(cells[columnMap.series]).text().trim();
    const seriesInfoRaw = $(cells[columnMap.seriesInfo]).text().trim();

    // Skip rows with missing essential data
    if (!toyNumber || !modelNameRaw) {
      continue;
    }

    // Parse model name and variant description
    let castingName = modelNameRaw;
    let variantDescription: string | null = null;
    const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
    if (variantMatch) {
      castingName = variantMatch[1].trim();
      variantDescription = variantMatch[2].trim();
    }

    // Extract flags and ratio from seriesInfo
    const isTreasureHunt = /Treasure Hunt/i.test(seriesInfoRaw) && !/Super Treasure Hunt/i.test(seriesInfoRaw);
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(seriesInfoRaw);
    const isRedEdition = /Red Edition/i.test(seriesInfoRaw);
    const isTargetExclusive = /Target Exclusive/i.test(seriesInfoRaw);
    const isWalmartExclusive = /Walmart Exclusive/i.test(seriesInfoRaw);
    const isKrogerExclusive = /Kroger Exclusive/i.test(seriesInfoRaw);
    const isNewForYear = new RegExp(`New for ${targetYear}`, 'i').test(seriesInfoRaw);

    // Extract series ratio (e.g. "2/5", "3/12", etc.)
    let seriesRatio: string | null = null;
    const ratioMatch = seriesInfoRaw.match(/(\d+\/\d+)/);
    if (ratioMatch) {
      seriesRatio = ratioMatch[1];
    }

    // Build a string of notes for any remaining information
    const notesParts: string[] = [];
    if (isNewForYear) notesParts.push(`New for ${targetYear}`);
    if (isRedEdition) notesParts.push('Red Edition');
    if (isTargetExclusive) notesParts.push('Target Exclusive');
    if (isWalmartExclusive) notesParts.push('Walmart Exclusive');
    if (isKrogerExclusive) notesParts.push('Kroger Exclusive');
    // Append ratio and the full series info for reference
    if (seriesRatio) notesParts.push(`Series ratio ${seriesRatio}`);
    // If variantDescription contains color variant indicator, add it to notes
    let colorVariant: string | null = null;
    if (variantDescription) {
      colorVariant = variantDescription;
    }
    const notes = notesParts.join('; ');

    // Lookup or create sub‑series
    let subSeries = subSeriesCache.get(subSeriesName);
    if (!subSeries) {
      // Check if sub‑series already exists in DB
      const existingSub = await prisma.subSeries.findFirst({
        where: {
          name: subSeriesName,
          collectionId: collectionRecord!.id,
        },
      });
      if (existingSub) {
        subSeries = { id: existingSub.id };
      } else {
        const created = await prisma.subSeries.create({
          data: {
            name: subSeriesName,
            collection: { connect: { id: collectionRecord!.id } },
          },
        });
        console.log(`Created SubSeries: ${subSeriesName}`);
        subSeries = { id: created.id };
      }
      subSeriesCache.set(subSeriesName, subSeries);
    }

    // Determine a model key. We use collector number if present, otherwise
    // fallback to casting name. Collector number uniquely identifies each
    // casting in the mainline (color variations reuse the same number).
    const modelKey = collectorNumber !== null ? collectorNumberStr : castingName;
    let model = modelCache.get(modelKey);
    if (!model) {
      // Check if a model already exists in the database for this casting and sub‑series.
      const existingModel = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeriesId: subSeries.id,
        },
      });
      if (existingModel) {
        model = { id: existingModel.id };
      } else {
        // Create a new Model record if none exists
        const createdModel = await prisma.model.create({
          data: {
            castingName,
            castingId: toyNumber, // store the toy number of the first variant as the castingId
            description: null,
            collection: { connect: { id: collectionRecord!.id } },
            subSeries: { connect: { id: subSeries.id } },
          },
        });
        model = { id: createdModel.id };
        console.log(`Created Model: ${castingName} (Collector #${collectorNumberStr})`);
      }
      modelCache.set(modelKey, model);
    }

    // Before creating a Variant, check if it already exists to avoid duplicates.
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: collectorNumberStr,
        color: colorVariant ?? undefined,
      },
    });
    if (existingVariant) {
      // Skip duplicate variant creation
      skippedCount++;
      continue;
    }

    // Create a new Variant record
    await prisma.variant.create({
      data: {
        model: { connect: { id: model.id } },
        year: targetYear,
        releaseName: subSeriesName,
        color: colorVariant ?? undefined,
        cardNumber: collectorNumberStr,
        isTreasureHunt,
        isSuperTreasureHunt,
        wheelType: undefined,
        cardVariation: undefined,
        owned: false,
        quantity: 0,
        condition: undefined,
        notes: notes.length > 0 ? notes : undefined,
      },
    });
    createdCount++;
  }

  console.log(`Import completed successfully. Created ${createdCount} variants, skipped ${skippedCount} duplicates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });












