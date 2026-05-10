/**
 * Complete script to import ALL 2018 Hot Wheels Mainline data from Wiki
 * 
 * This script imports:
 * 1. Main table (COL# 1-365)
 * 2. Treasure Hunt table
 * 3. Super Treasure Hunt table
 * 4. All additional tables after TH/STH (COL# 366+)
 * 
 * All tables are imported into the Mainline collection for 2018.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

interface TableInfo {
  heading: string;
  table: any;
  subSeriesName: string;
  tableType: 'main' | 'th' | 'sth' | 'additional';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('🚀 Starting complete 2018 Mainline import...\n');

  // Fetch Wiki page
  console.log('📥 Fetching Wiki page...');
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Ensure Year exists
  const targetYear = 2018;
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`✅ Created Year record for ${targetYear}`);
  }

  // Ensure Collection exists
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
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`✅ Created Collection record for ${collectionName}`);
  }

  // Find all tables to process
  const tablesToProcess: TableInfo[] = [];
  
  // 1. Main table (first table)
  const mainTable = $('table').first();
  if (mainTable.length > 0) {
    tablesToProcess.push({
      heading: '2018 Hot Wheels #1–365',
      table: mainTable,
      subSeriesName: '', // Will be determined from row data
      tableType: 'main',
    });
    console.log('✅ Found main table');
  }

  // 2. Find TH, STH, and additional tables
  const headings = $('h2, h3');
  let foundTH = false;
  let foundSTH = false;

  headings.each((index, heading) => {
    const headingText = $(heading).text().trim();
    
    // TH table
    if (/Hot Wheels Treasure Hunt/i.test(headingText) && !/Super Treasure Hunt/i.test(headingText)) {
      foundTH = true;
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: 'Treasure Hunt',
          tableType: 'th',
        });
        console.log(`✅ Found TH table: ${headingText}`);
      }
    }
    
    // STH table
    if (/Super Treasure Hunt/i.test(headingText)) {
      foundSTH = true;
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: 'Super Treasure Hunt',
          tableType: 'sth',
        });
        console.log(`✅ Found STH table: ${headingText}`);
      }
    }
    
    // Additional tables after TH/STH
    if (foundTH && foundSTH) {
      if (headingText && !/Super Treasure Hunt/i.test(headingText) && !/Hot Wheels Treasure Hunt/i.test(headingText)) {
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          const subSeriesName = headingText.replace(/\[.*?\]/g, '').trim();
          tablesToProcess.push({
            heading: headingText,
            table: $(nextElement[0]),
            subSeriesName: subSeriesName,
            tableType: 'additional',
          });
          console.log(`✅ Found additional table: ${subSeriesName}`);
        }
      }
    }
  });

  console.log(`\n📊 Total tables to process: ${tablesToProcess.length}\n`);

  // Caches
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  
  // COL# counter for additional tables (starts at 366)
  let currentCollectorNumber = 366;
  
  let totalVariantsCreated = 0;
  let totalVariantsSkipped = 0;

  // Process each table
  for (const tableInfo of tablesToProcess) {
    const { table, subSeriesName: defaultSubSeriesName, tableType } = tableInfo;
    
    console.log(`\n📋 Processing ${tableType} table: ${tableInfo.heading}`);
    
    const rows = table.find('tbody tr');
    console.log(`   Found ${rows.length} rows`);

    // Get headers to understand column structure
    const headerRow = table.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();
    
    // Determine column indices
    let toyNumberIndex = 0;
    let collectorNumberIndex = 1;
    let modelNameIndex = 2;
    let subSeriesIndex = 3;
    let seriesInfoIndex = 4;
    let imageIndex = 5;

    headers.forEach((header: string, index: number) => {
      if (/Toy#|Toy #/i.test(header)) toyNumberIndex = index;
      if (/COL#|Collector|Card/i.test(header)) collectorNumberIndex = index;
      if (/Model|Name|Cast/i.test(header) && index > toyNumberIndex) modelNameIndex = index;
      if (/Series|Sub/i.test(header) && index > modelNameIndex) subSeriesIndex = index;
      if (/Series#|Series #|Info/i.test(header)) seriesInfoIndex = index;
      if (/Image|Photo|Pic/i.test(header)) imageIndex = index;
    });

    let rowCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue; // Skip header rows

      const toyNumber = $(cells[toyNumberIndex] || cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue; // Skip empty rows

      const collectorNumberStr = tableType === 'main' 
        ? $(cells[collectorNumberIndex] || cells[1]).text().trim()
        : null; // Additional tables get sequential COL#
      
      const modelNameRaw = $(cells[modelNameIndex] || cells[2] || cells[1] || cells[0]).text().trim();
      if (!modelNameRaw) continue;

      // For main table, get subSeries from row; for others use default
      let subSeriesName = tableType === 'main'
        ? $(cells[subSeriesIndex] || cells[3]).text().trim()
        : defaultSubSeriesName;
      
      const seriesInfoRaw = tableType === 'main'
        ? $(cells[seriesInfoIndex] || cells[4]).text().trim()
        : '';

      // Clean subSeriesName for main table
      if (tableType === 'main') {
        subSeriesName = subSeriesName.replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '').trim();
        subSeriesName = subSeriesName.replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '').trim();
      }

      // Parse model name
      let castingName = modelNameRaw;
      let variantDescription: string | null = null;
      const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
        variantDescription = variantMatch[2].trim();
      }

      // Determine COL#
      const cardNumberStr = tableType === 'main' && collectorNumberStr
        ? collectorNumberStr
        : currentCollectorNumber.toString();
      
      if (tableType !== 'main') {
        currentCollectorNumber++;
      }

      // Extract flags
      const combinedText = `${subSeriesName} ${seriesInfoRaw}`;
      const isSuperTreasureHunt = /Super Treasure Hunt/i.test(combinedText) || tableType === 'sth';
      const isTreasureHunt = !isSuperTreasureHunt && (/Treasure Hunt/i.test(combinedText) || tableType === 'th');
      const isRedEdition = /Red Edition/i.test(seriesInfoRaw);
      const isTargetExclusive = /Target Exclusive/i.test(seriesInfoRaw);
      const isWalmartExclusive = /Walmart Exclusive/i.test(seriesInfoRaw);
      const isKrogerExclusive = /Kroger Exclusive/i.test(seriesInfoRaw);
      const isNewFor2018 = /New for 2018/i.test(seriesInfoRaw);

      // Extract series ratio
      let seriesRatio: string | null = null;
      const ratioMatch = seriesInfoRaw.match(/(\d+\/\d+)/);
      if (ratioMatch) {
        seriesRatio = ratioMatch[1];
      }

      // Build notes
      const notesParts: string[] = [];
      if (isNewFor2018) notesParts.push('New for 2018');
      if (isRedEdition) notesParts.push('Red Edition');
      if (isTargetExclusive) notesParts.push('Target Exclusive');
      if (isWalmartExclusive) notesParts.push('Walmart Exclusive');
      if (isKrogerExclusive) notesParts.push('Kroger Exclusive');
      if (seriesRatio) notesParts.push(`Series ratio ${seriesRatio}`);
      const notes = notesParts.join('; ');

      // Get or create SubSeries
      let subSeries = subSeriesCache.get(subSeriesName);
      if (!subSeries) {
        const existingSub = await prisma.subSeries.findFirst({
          where: {
            name: subSeriesName,
            collectionId: collectionRecord.id,
          },
        });
        if (existingSub) {
          subSeries = { id: existingSub.id };
        } else {
          const created = await prisma.subSeries.create({
            data: {
              name: subSeriesName,
              collection: { connect: { id: collectionRecord.id } },
            },
          });
          subSeries = { id: created.id };
        }
        subSeriesCache.set(subSeriesName, subSeries);
      }

      // Get or create Model
      const modelKey = tableType === 'main' && collectorNumberStr
        ? collectorNumberStr
        : `${subSeriesName}-${castingName}`;
      
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
              collection: { connect: { id: collectionRecord.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (by Toy#)
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: toyNumber,
          year: targetYear,
        },
      });

      if (existingVariant) {
        skippedCount++;
        continue;
      }

      // Create Variant
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: subSeriesName,
          color: variantDescription ?? undefined,
          cardNumber: cardNumberStr,
          toyNumber: toyNumber,
          isTreasureHunt,
          isSuperTreasureHunt,
          wheelType: undefined,
          cardVariation: undefined,
          owned: false,
          quantity: 0,
          condition: undefined,
          notes: notes.length > 0 ? notes : undefined,
        } as any,
      });

      rowCount++;
      createdCount++;
      totalVariantsCreated++;
    }

    console.log(`   ✅ Processed: ${rowCount} rows, ${createdCount} created, ${skippedCount} skipped`);
    totalVariantsSkipped += skippedCount;
  }

  console.log(`\n🎉 Import completed!`);
  console.log(`   Total variants created: ${totalVariantsCreated}`);
  console.log(`   Total variants skipped: ${totalVariantsSkipped}`);
  console.log(`   COL# range: 1-${currentCollectorNumber - 1}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






