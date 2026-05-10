/**
 * Script to import the 2021 Hot Wheels Mainline set into your database using Prisma.
 *
 * This script fetches the 2021 mainline table from the Hot Wheels Fandom wiki,
 * parses each row to extract the toy number, collector number, model name,
 * sub‑series, series info (e.g. New for 2021!, Treasure Hunt, Super Treasure Hunt,
 * Target/Walmart/Kroger exclusives), and then writes the data into the
 * corresponding Prisma models: Year → Collection → SubSeries → Model → Variant.
 *
 * How to use:
 *
 *   1. Install the cheerio package (used for HTML parsing) and ts-node
 *      (to run TypeScript files directly):
 *
 *         npm install cheerio
 *         npm install -D ts-node typescript
 *
 *      If you prefer JavaScript, you can rename this file with a `.js`
 *      extension and remove the type annotations.
 *
 *   2. Ensure your Prisma schema has been migrated and that the database
 *      connection details are configured in your `.env` file. In this project
 *      setup, the 2021 mainline data will be associated with the `Year`
 *      record for 2021 and the `Collection` record named "Mainline".
 *
 *   3. Run the script with ts-node:
 *
 *         npx ts-node import_2021_mainline.ts
 *
 *      Alternatively, if you have added a script entry in your package.json
 *      (e.g. "import:2021-mainline": "ts-node import_2021_mainline.ts"), you can
 *      run it via `npm run import:2021-mainline`.
 *
 * Notes:
 *   - The script is idempotent regarding the `Year`, `Collection`, and
 *     `SubSeries` creation but not for models and variants. If you run it
 *     multiple times, you will end up with duplicated models and variants.
 *     Clean your database or adjust the script to check for existing
 *     collector numbers before running again.
 *   - Because the Fandom wiki does not assign new collector numbers to
 *     color variations, multiple variants will share the same collector
 *     number but have unique toy numbers. This script uses the first
 *     occurrence of a collector number to create the `Model` and then
 *     associates subsequent rows with the same collector number as
 *     additional `Variant` records.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

// Node 18 includes a global fetch implementation. If you are on an older
// Node version you may need to install node-fetch and import it here.

// URL of the Fandom page containing the 2021 mainline list
const URL = 'https://hotwheels.fandom.com/wiki/List_of_2021_Hot_Wheels';

// Instantiate Prisma client
const prisma = new PrismaClient();

// Helper function to pause execution for debugging or rate‑limiting (not used
// here but available if needed).
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution function
async function main() {
  console.log('Fetching 2021 mainline data…');
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  // Locate the table containing the list. The table is the first
  // table after the header "2021 Hot Wheels #1–250".
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the mainline table on the page');
  }

  // Ensure the Year record exists
  const targetYear = 2021;
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

  // In‑memory caches to avoid redundant lookups/creates
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>(); // keyed by collector number

  // Iterate over each row of the table body
  const rows = table.find('tbody tr');
  console.log(`Found ${rows.length} rows. Processing…`);

  // Check table structure by examining first few rows
  let expectedCellCount = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const testRow = rows[i];
    const testCells = $(testRow).find('td');
    if (testCells.length > 0) {
      expectedCellCount = Math.max(expectedCellCount, testCells.length);
    }
  }
  console.log(`Table structure detected: ${expectedCellCount} columns`);

  let processedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue; // skip header or empty rows

    // Skip rows with insufficient cells (might be header or malformed)
    if (cells.length < 3) {
      skippedCount++;
      continue;
    }

    // Dynamically parse cells based on table structure
    // Standard structure: Toy#, COL#, Model Name, Series, Series#
    // But table might have different column order or additional columns
    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const modelNameRaw = cells.length > 2 ? $(cells[2]).text().trim() : '';
    const subSeriesNameRaw = cells.length > 3 ? $(cells[3]).text().trim() : '';
    const seriesInfoRaw = cells.length > 4 ? $(cells[4]).text().trim() : '';

    // Skip rows with empty Toy# or Model Name
    if (!toyNumber || !modelNameRaw) {
      skippedCount++;
      continue;
    }

    const collectorNumber = collectorNumberStr === '' ? null : parseInt(collectorNumberStr, 10);
    
    // Clean subSeriesName - remove TH/STH markers and exclusive/store markers for the series name itself
    // TH/STH info will be detected separately and stored in variant flags
    // Also remove "Super", "Walmart Exclusive", "Kroger Exclusive", etc. from subSeriesName
    // Also remove "New for 2021!", "New in Mainline", etc. markers
    let subSeriesName = subSeriesNameRaw
      .replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '')
      .replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '')
      .replace(/\s*Super\s*$/gi, '') // Remove "Super" at the end
      .replace(/\s*Walmart Exclusive\s*/gi, '')
      .replace(/\s*Kroger Exclusive\s*/gi, '')
      .replace(/\s*Target Exclusive\s*/gi, '')
      .replace(/\s*Dollar General Exclusive\s*/gi, '')
      .replace(/\s*GameStop Exclusive\s*/gi, '')
      .replace(/\s*Walgreens Exclusive\s*/gi, '')
      .replace(/\s*Red Edition\s*/gi, '') // Red Edition is in seriesInfo, not subSeriesName
      .replace(/\s*New for 2021!\s*/gi, '')
      .replace(/\s*New in Mainline\s*/gi, '')
      .replace(/\s*New for 2021\s*/gi, '')
      .trim();
    
    // Handle empty subSeriesName - use "Mainline" as default
    // This ensures consistent subSeries matching between import and image scripts
    if (!subSeriesName || subSeriesName === '') {
      subSeriesName = 'Mainline';
    }

    // Parse model name and variant description
    let castingName = modelNameRaw;
    let variantDescription: string | null = null;
    const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
    if (variantMatch) {
      castingName = variantMatch[1].trim();
      const parsedDescription = variantMatch[2].trim();
      // Ignore "Mainline" as variantDescription - it's not a color variant,
      // just the subSeriesName repeated in parentheses
      if (parsedDescription.toLowerCase() !== 'mainline') {
        variantDescription = parsedDescription;
      }
    }

    // Extract flags and ratio from seriesInfo
    // Check both subSeriesNameRaw (Series column - ORIGINAL, not cleaned) and seriesInfoRaw (Series# column) for TH/STH
    // IMPORTANT: Check Super Treasure Hunt FIRST, because it contains "Treasure Hunt" text
    const combinedText = `${subSeriesNameRaw} ${seriesInfoRaw}`;
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(combinedText);
    // Only mark as TH if it's NOT a Super Treasure Hunt
    const isTreasureHunt = !isSuperTreasureHunt && /Treasure Hunt/i.test(combinedText);
    
    // Debug: Log TH/STH detection
    if (isTreasureHunt || isSuperTreasureHunt) {
      console.log(`Found ${isSuperTreasureHunt ? 'STH' : 'TH'}: ${castingName} (Card #${collectorNumberStr}, Toy# ${toyNumber}) - Series: "${subSeriesNameRaw}", Series#: "${seriesInfoRaw}"`);
    }
    const isRedEdition = /Red Edition/i.test(seriesInfoRaw);
    const isTargetExclusive = /Target Exclusive/i.test(seriesInfoRaw);
    const isWalmartExclusive = /Walmart Exclusive/i.test(seriesInfoRaw);
    const isKrogerExclusive = /Kroger Exclusive/i.test(seriesInfoRaw);
    const isNewFor2021 = /New for 2021/i.test(seriesInfoRaw);

    // Extract series ratio (e.g. "2/5", "3/12", etc.)
    let seriesRatio: string | null = null;
    const ratioMatch = seriesInfoRaw.match(/(\d+\/\d+)/);
    if (ratioMatch) {
      seriesRatio = ratioMatch[1];
    }

    // Build a string of notes for any remaining information
    const notesParts: string[] = [];
    if (isNewFor2021) notesParts.push('New for 2021');
    if (isTreasureHunt) notesParts.push('Treasure Hunt');
    if (isSuperTreasureHunt) notesParts.push('Super Treasure Hunt');
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
      // IMPORTANT: Same castingName + subSeries = same model, regardless of Toy# or color
      // This ensures that all color variants (1st Color, 2nd Color, etc.) use the same model
      const existingModel = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeriesId: subSeries.id,
          collectionId: collectionRecord!.id, // Also check collection to be safe
        },
      });
      if (existingModel) {
        model = { id: existingModel.id };
        // Update castingId if it's not set yet (use first Toy# encountered)
        if (!existingModel.castingId) {
          await prisma.model.update({
            where: { id: existingModel.id },
            data: { castingId: toyNumber },
          });
        }
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
        console.log(`Created Model: ${castingName} (Collector #${collectorNumberStr}, Toy# ${toyNumber})`);
      }
      modelCache.set(modelKey, model);
    }

    // Before creating/updating a Variant, check if it already exists by Toy#
    // IMPORTANT: Use Toy# for matching since it's unique per variant
    // This allows us to update existing variants and add missing ones without duplicates
    const existingVariant = await prisma.variant.findFirst({
      where: {
        toyNumber: toyNumber.trim(),
        year: targetYear,
      },
    });
    
    if (existingVariant) {
      // Update existing variant with latest data from wiki
      await prisma.variant.update({
        where: { id: existingVariant.id },
        data: {
          model: { connect: { id: model.id } },
          releaseName: subSeriesName,
          color: colorVariant ?? null,
          cardNumber: collectorNumberStr,
          isTreasureHunt,
          isSuperTreasureHunt,
          notes: notes.length > 0 ? notes : undefined,
        },
      });
      console.log(`Updated variant: ${castingName} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr})`);
      continue;
    }

    // Create a new Variant record
    await prisma.variant.create({
      data: {
        model: { connect: { id: model.id } },
        year: targetYear,
        toyNumber: toyNumber.trim(), // Store Toy# in variant for matching
        releaseName: subSeriesName,
        color: colorVariant ?? null, // Use null instead of undefined for Prisma
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
    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`Progress: ${processedCount} variants processed...`);
    }
  }

  console.log(`\nImport completed successfully.`);
  console.log(`Processed: ${processedCount} variants`);
  console.log(`Skipped: ${skippedCount} rows`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

