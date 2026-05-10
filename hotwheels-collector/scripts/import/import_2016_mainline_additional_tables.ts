/**
 * Script to import TH, STH, and additional tables after them from the 2016 Hot Wheels wiki.
 * These tables will be imported as SubSeries under the Mainline collection.
 * COL# numbers will start after the main mainline models.
 * 
 * This script:
 * 1. Finds TH and STH tables
 * 2. Finds all tables after TH/STH
 * 3. For each table, creates SubSeries based on heading
 * 4. Imports models and variants with sequential COL# starting after max mainline COL#
 * 5. Uses Toy# for matching
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2016_Hot_Wheels';

interface TableInfo {
  heading: string;
  table: any;
  subSeriesName: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('Fetching 2016 Hot Wheels wiki page...');
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Find 2016 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2016,
      },
    },
  });

  if (!mainlineCollection) {
    throw new Error('2016 Mainline collection not found. Please import mainline data first.');
  }

  // Find max COL# from existing mainline variants to determine starting COL# for additional tables
  const maxVariant = await prisma.variant.findFirst({
    where: {
      year: 2016,
      model: {
        collectionId: mainlineCollection.id,
      },
      cardNumber: { not: null },
    },
    orderBy: {
      cardNumber: 'desc',
    },
    select: {
      cardNumber: true,
    },
  });

  let currentCollectorNumber = 1;
  if (maxVariant?.cardNumber) {
    const maxColNum = parseInt(maxVariant.cardNumber);
    if (!isNaN(maxColNum)) {
      currentCollectorNumber = maxColNum + 1;
      console.log(`Found max COL# from mainline: ${maxColNum}, starting additional tables from: ${currentCollectorNumber}`);
    }
  } else {
    // If no numeric COL# found, start from a safe number (usually 366 for most years)
    currentCollectorNumber = 366;
    console.log(`No max COL# found, starting from default: ${currentCollectorNumber}`);
  }

  // Find all headings (h2, h3)
  const headings = $('h2, h3');
  const tablesToProcess: TableInfo[] = [];
  let foundTH = false;
  let foundSTH = false;

  // Find TH and STH tables, then all tables after them
  headings.each((index, heading) => {
    const headingText = $(heading).text().trim();
    
    // Check if this is TH or STH heading
    if (/Hot Wheels Treasure Hunt/i.test(headingText) && !/Super Treasure Hunt/i.test(headingText)) {
      foundTH = true;
      console.log(`Found TH heading: ${headingText}`);
      
      // Find the next table after this heading
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const subSeriesName = 'Treasure Hunt';
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: subSeriesName,
        });
        console.log(`  → Found TH table for SubSeries: ${subSeriesName}`);
      }
    }
    
    if (/Super Treasure Hunt/i.test(headingText)) {
      foundSTH = true;
      console.log(`Found STH heading: ${headingText}`);
      
      // Find the next table after this heading
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const subSeriesName = 'Super Treasure Hunt';
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: subSeriesName,
        });
        console.log(`  → Found STH table for SubSeries: ${subSeriesName}`);
      }
    }
    
    // If we've found both TH and STH, start collecting all subsequent tables
    if (foundTH && foundSTH) {
      // Check if this heading comes after STH
      if (headingText && !/Super Treasure Hunt/i.test(headingText) && !/Hot Wheels Treasure Hunt/i.test(headingText)) {
        // Find the next table after this heading
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          // Use heading text as SubSeries name
          const subSeriesName = headingText.replace(/\[.*?\]/g, '').trim(); // Remove [edit] etc.
          tablesToProcess.push({
            heading: headingText,
            table: $(nextElement[0]),
            subSeriesName: subSeriesName,
          });
          console.log(`  → Found additional table for SubSeries: ${subSeriesName}`);
        }
      }
    }
  });

  console.log(`\n✅ Found ${tablesToProcess.length} tables to process\n`);

  // SubSeries cache
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const startCol = currentCollectorNumber;

  // Process each table
  for (const tableInfo of tablesToProcess) {
    const { subSeriesName, table } = tableInfo;
    console.log(`\n📋 Processing table: ${subSeriesName}`);

    // Get or create SubSeries
    let subSeries = subSeriesCache.get(subSeriesName);
    if (!subSeries) {
      const existingSub = await prisma.subSeries.findFirst({
        where: {
          name: subSeriesName,
          collectionId: mainlineCollection.id,
        },
      });
      if (existingSub) {
        subSeries = { id: existingSub.id };
      } else {
        const created = await prisma.subSeries.create({
          data: {
            name: subSeriesName,
            collection: { connect: { id: mainlineCollection.id } },
          },
        });
        console.log(`  Created SubSeries: ${subSeriesName}`);
        subSeries = { id: created.id };
      }
      subSeriesCache.set(subSeriesName, subSeries);
    }

    // Get table rows
    const rows = table.find('tbody tr');
    console.log(`  Found ${rows.length} rows`);

    // Get headers to understand column structure
    const headerRow = table.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();
    console.log(`  Headers: ${headers.join(', ')}`);

    // Determine column indices
    let toyNumberIndex = 0;
    let modelNameIndex = 1;
    let cardNumberIndex = -1;
    let imageIndex = -1;

    headers.forEach((header: string, index: number) => {
      if (/Toy#|Toy #/i.test(header)) toyNumberIndex = index;
      if (/Model|Name|Cast/i.test(header) && index > toyNumberIndex) modelNameIndex = index;
      if (/COL#|Collector|Card/i.test(header)) cardNumberIndex = index;
      if (/Image|Photo|Pic/i.test(header)) imageIndex = index;
    });

    // Process each row
    let rowCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue; // Skip header rows

      const toyNumber = $(cells[toyNumberIndex] || cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue; // Skip empty rows

      // Get model name
      const modelNameRaw = $(cells[modelNameIndex] || cells[1] || cells[0]).text().trim();
      
      // Parse model name (may contain color variant in parentheses)
      let castingName = modelNameRaw;
      let variantDescription: string | null = null;
      const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
        variantDescription = variantMatch[2].trim();
      }

      // Always assign sequential COL# starting from currentCollectorNumber
      // Even if the table has existing COL# values, we ignore them and assign new sequential numbers
      const cardNumberStr = currentCollectorNumber.toString();
      currentCollectorNumber++;

      // Determine if TH or STH
      const isTreasureHunt = subSeriesName.toLowerCase().includes('treasure hunt') && 
                             !subSeriesName.toLowerCase().includes('super');
      const isSuperTreasureHunt = subSeriesName.toLowerCase().includes('super treasure hunt');

      // Get or create model
      const modelKey = `${subSeriesName}-${castingName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: castingName,
            subSeriesId: subSeries.id,
          },
        });
        if (existingModel) {
          model = { id: existingModel.id };
        } else {
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber,
              description: null,
              collection: { connect: { id: mainlineCollection.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`    Created Model: ${castingName} (Toy#: ${toyNumber})`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists in THIS subseries (allow duplicates across different subseries)
      // CRITICAL: Check by Toy# as well since 2016 has same COL# but different Toy# for 2nd/3rd color
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: toyNumber,
          year: 2016,
          releaseName: subSeriesName, // Check same subseries
        },
      });

      if (existingVariant) {
        console.log(`    ⚠️  Variant already exists for ${castingName} (Toy#: ${toyNumber}) in ${subSeriesName}`);
        // Update COL# if needed (in case it was imported before with wrong COL#)
        if (existingVariant.cardNumber !== cardNumberStr) {
          await prisma.variant.update({
            where: { id: existingVariant.id },
            data: { cardNumber: cardNumberStr },
          });
          console.log(`    ✓ Updated COL# to ${cardNumberStr}`);
        }
        continue;
      }

      // Create variant
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: 2016,
          releaseName: subSeriesName,
          color: variantDescription ?? null,
          cardNumber: cardNumberStr,
          toyNumber: toyNumber,
          isTreasureHunt,
          isSuperTreasureHunt,
          wheelType: null,
          cardVariation: null,
          owned: false,
          quantity: 0,
          condition: null,
          notes: null,
        } as any,
      });

      rowCount++;
      console.log(`    ✓ Created variant: ${castingName} (Toy#: ${toyNumber}, COL#: ${cardNumberStr})`);
    }

    console.log(`  ✅ Processed ${rowCount} variants from ${subSeriesName}`);
  }

  console.log(`\n✅ Import completed! Total COL# range: ${startCol}-${currentCollectorNumber - 1}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

