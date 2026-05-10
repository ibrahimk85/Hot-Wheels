/**
 * Script to import the 2010 USA Hot Wheels Mainline set into your database using Prisma.
 *
 * This script fetches ALL tables from the 2010 Hot Wheels Fandom wiki page.
 * Each table represents a different sub-series. The script processes each table
 * separately, extracting the toy number, collector number, model name, sub‑series
 * (from heading or Series column), series info (TH/STH from Series column), and
 * then writes the data into the corresponding Prisma models.
 *
 * IMPORTANT: 2010'da 2nd color ve 3rd color varyantları aynı COL#'ye sahipken
 * farklı Toy#'ye sahip. Bu nedenle Toy# mutlaka kaydedilmeli ve eşleştirmede kullanılmalı.
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
 *   3. Run the script with ts-node:
 *
 *         npx ts-node import_2010_usa_mainline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

// URL of the Fandom page containing the 2010 mainline list
const URL = 'https://hotwheels.fandom.com/wiki/List_of_2010_Hot_Wheels';

// Instantiate Prisma client
const prisma = new PrismaClient();

interface TableInfo {
  heading: string | null;
  table: any;
  subSeriesName: string;
}

// Helper function to pause execution for debugging or rate‑limiting
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fetching 2010 USA mainline data…');
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  // Ensure the Year record exists (use same Year for both USA and International)
  const targetYear = 2010;
  let yearRecord = await prisma.year.findFirst({ 
    where: { 
      year: targetYear,
      notes: null // Use the same Year record without notes
    } 
  });
  if (!yearRecord) {
    // Check if there's any 2010 year record (even with notes)
    const anyYearRecord = await prisma.year.findFirst({
      where: { year: targetYear }
    });
    if (anyYearRecord) {
      // Update existing year to remove notes
      yearRecord = await prisma.year.update({
        where: { id: anyYearRecord.id },
        data: { notes: null }
      });
      console.log(`Updated Year record for ${targetYear} (removed notes)`);
    } else {
      yearRecord = await prisma.year.create({ 
        data: { 
          year: targetYear,
          notes: null
        } 
      });
      console.log(`Created Year record for ${targetYear}`);
    }
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

  // Ensure the "Mainline (USA)" SubSeries exists
  const mainlineUSASubSeriesName = 'Mainline (USA)';
  let mainlineUSASubSeries = await prisma.subSeries.findFirst({
    where: {
      name: mainlineUSASubSeriesName,
      collectionId: collectionRecord.id,
    },
  });
  if (!mainlineUSASubSeries) {
    mainlineUSASubSeries = await prisma.subSeries.create({
      data: {
        name: mainlineUSASubSeriesName,
        collection: { connect: { id: collectionRecord.id } },
      },
    });
    console.log(`Created SubSeries: ${mainlineUSASubSeriesName}`);
  }

  // Find ALL tables on the page
  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  // Build list of tables with their headings (h2, h3, h4)
  const tablesToProcess: TableInfo[] = [];
  
  allTables.each((index, tableElement) => {
    const $table = $(tableElement);
    
    // Try to find the heading before this table (h2, h3, h4)
    let heading: string | null = null;
    let currentElement = $table.prev();
    
    // Look backwards for the nearest heading
    for (let i = 0; i < 5; i++) {
      if (currentElement.length === 0) break;
      const tagName = currentElement[0]?.tagName?.toLowerCase();
      if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        heading = currentElement.text().trim();
        break;
      }
      currentElement = currentElement.prev();
    }
    
    // If no heading found, try to get subSeries name from first row's Series column
    let subSeriesName = heading || `Table ${index + 1}`;
    
    // Check if table has data rows (at least 2 rows: header + 1 data row)
    const rows = $table.find('tbody tr, tr');
    if (rows.length < 2) {
      console.log(`  Skipping table ${index + 1} (too few rows: ${rows.length})`);
      return;
    }
    
    // Try to extract subSeries name from first data row's Series column if available
    const firstDataRow = rows.eq(1); // Skip header row
    const cells = firstDataRow.find('td');
    if (cells.length >= 4) {
      const seriesCell = cells.eq(3).text().trim(); // Series column (index 3)
      if (seriesCell && seriesCell.length > 0) {
        // Use Series column value, but clean it
        subSeriesName = seriesCell
          .replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '')
          .replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '')
          .replace(/\s*Super\s*$/gi, '')
          .trim();
      }
    }
    
    // If we still don't have a good name, use heading or default
    if (!subSeriesName || subSeriesName === `Table ${index + 1}`) {
      subSeriesName = heading || `Table ${index + 1}`;
    }
    
    tablesToProcess.push({
      heading: heading,
      table: $table,
      subSeriesName: subSeriesName,
    });
    
    console.log(`  Table ${index + 1}: "${subSeriesName}" (${rows.length} rows, heading: ${heading || 'none'})`);
  });

  console.log(`\nProcessing ${tablesToProcess.length} tables...\n`);

  // In‑memory caches to avoid redundant lookups/creates
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>(); // keyed by collector number

  // Process each table
  for (const tableInfo of tablesToProcess) {
    const { subSeriesName, table } = tableInfo;
    console.log(`\n📋 Processing table: ${subSeriesName}`);

    // All variants will use the "Mainline (USA)" SubSeries

    // Get table rows
    const rows = table.find('tbody tr, tr');
    console.log(`  Found ${rows.length} rows`);

    // Process each row (skip first row if it's a header)
    let processedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue; // skip header or empty rows

      // Column structure: Toy# (0), COL# (1), Model Name (2), Series (3), Series# (4), Image (5)
      const toyNumber = $(cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue; // Skip rows without Toy#
      
      const collectorNumberStr = $(cells[1]).text().trim();
      const collectorNumber = collectorNumberStr === '' ? null : parseInt(collectorNumberStr, 10);
      const modelNameRaw = $(cells[2]).text().trim();
      const subSeriesNameRaw = $(cells[3]).text().trim(); // Keep original for TH/STH detection
      const seriesInfoRaw = $(cells[4] || cells[3]).text().trim(); // Series# column, fallback to Series if no Series#

      // Parse model name and variant description
      // Handle 2nd Color, 3rd Color variants in Model Name column
      let castingName = modelNameRaw;
      let variantDescription: string | null = null;
      const variantMatch = modelNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
        const parsedDescription = variantMatch[2].trim();
        // Keep color variant info (2nd Color, 3rd Color, etc.)
        if (parsedDescription.toLowerCase() !== 'mainline') {
          variantDescription = parsedDescription;
        }
      }

      // Extract flags and ratio from seriesInfo (Series# column) and subSeriesNameRaw (Series column)
      // Check both for TH/STH info
      const combinedText = `${subSeriesNameRaw} ${seriesInfoRaw}`;
      const isSuperTreasureHunt = /Super Treasure Hunt/i.test(combinedText);
      const isTreasureHunt = !isSuperTreasureHunt && /Treasure Hunt/i.test(combinedText);
      const isRedEdition = /Red Edition/i.test(combinedText);
      const isTargetExclusive = /Target Exclusive/i.test(combinedText);
      const isWalmartExclusive = /Walmart Exclusive/i.test(combinedText);
      const isKrogerExclusive = /Kroger Exclusive/i.test(combinedText);
      const isNewFor2010 = /New for 2010/i.test(combinedText);

      // Extract series ratio (e.g. "2/5", "3/12", etc.)
      let seriesRatio: string | null = null;
      const ratioMatch = seriesInfoRaw.match(/(\d+\/\d+)/);
      if (ratioMatch) {
        seriesRatio = ratioMatch[1];
      }

      // Build notes
      const notesParts: string[] = [];
      if (isNewFor2010) notesParts.push('New for 2010');
      if (isTreasureHunt) notesParts.push('Treasure Hunt');
      if (isSuperTreasureHunt) notesParts.push('Super Treasure Hunt');
      if (isRedEdition) notesParts.push('Red Edition');
      if (isTargetExclusive) notesParts.push('Target Exclusive');
      if (isWalmartExclusive) notesParts.push('Walmart Exclusive');
      if (isKrogerExclusive) notesParts.push('Kroger Exclusive');
      if (seriesRatio) notesParts.push(`Series ratio ${seriesRatio}`);
      
      let colorVariant: string | null = null;
      if (variantDescription) {
        colorVariant = variantDescription;
      }
      const notes = notesParts.join('; ');

      // Use the "Mainline (USA)" SubSeries for all variants
      const finalSubSeries = { id: mainlineUSASubSeries.id };

      // Determine model key
      const modelKey = collectorNumber !== null ? collectorNumberStr : `Mainline (USA)-${castingName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: castingName,
            subSeriesId: finalSubSeries.id,
            collectionId: collectionRecord!.id,
          },
        });
        if (existingModel) {
          model = { id: existingModel.id };
          if (!existingModel.castingId) {
            await prisma.model.update({
              where: { id: existingModel.id },
              data: { castingId: toyNumber },
            });
          }
        } else {
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber,
              description: null,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: finalSubSeries.id } },
            },
          });
          model = { id: createdModel.id };
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (by Toy# AND color variant - CRITICAL for 2010)
      // Same Toy# can appear multiple times for 2nd Color, 3rd Color variants
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: toyNumber,
          year: targetYear,
          color: colorVariant ?? null, // Also check color to distinguish 2nd/3rd Color variants
        },
      });
      if (existingVariant) {
        console.log(`    Skipping duplicate variant: ${castingName} (Toy#: ${toyNumber}, Color: ${colorVariant || 'none'})`);
        continue;
      }

      // Create variant
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: mainlineUSASubSeriesName,
          color: colorVariant ?? null,
          cardNumber: collectorNumberStr,
          // @ts-ignore
          toyNumber: toyNumber, // IMPORTANT: Save Toy# for each variant
          isTreasureHunt,
          isSuperTreasureHunt,
          wheelType: null,
          cardVariation: null,
          owned: false,
          quantity: 0,
          condition: null,
          notes: notes.length > 0 ? notes : null,
        },
      });

      processedCount++;
    }

    console.log(`  ✅ Processed ${processedCount} variants from ${subSeriesName}`);
  }

  console.log('\n✅ Import completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
