/**
 * Script to import the 2021 Hot Wheels Fast & Furious Premium set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2021 Fast & Furious Premium section from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (each sub-series has its own table)
 *   3. Extracts data: Toy #, Col# (Series #), Casting Name, Body Color, Wheel Type, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Fast & Furious Premium) → SubSeries → Model → Variant
 *
 * Fast & Furious Premium-specific:
 * - No TH/STH (always false)
 * - SubSeries names are extracted from headings before tables (varies by year)
 * - Model metadata from detail pages
 *
 * How to use:
 *   npx ts-node scripts/import/import_2021_fast_furious_premium.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { fetchFandomModelMetadata } from '../lib/fandom-model-metadata.ts';
import { parsePremiumWikiRowForImport } from '../lib/fast-furious-premium-wiki-row.ts';

const targetYear = 2021;
const URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Fast_%26_Furious_Premium_Series`;

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract sub-series name from table context (heading before table)
 * For Fast & Furious Premium, sub-series names vary
 */
function extractSubSeriesName($: cheerio.CheerioAPI, table: any): string {
  // Try to find heading before table
  let subSeriesName = '';
  
  // Check previous h2, h3, h4 elements
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    // Skip generic headings like "Contents", "References", etc.
    if (!/^(contents|references|see also|external links|categories)$/i.test(headingText)) {
      subSeriesName = headingText;
    }
  }
  
  // Check table caption
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption;
    }
  }
  
  // Check for span.mw-headline (Fandom wiki heading structure)
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText;
      }
    }
  }
  
  return (subSeriesName || 'Unknown Series').replace(/\[\]\s*$/, '').trim();
}

async function main() {
  console.log(`Fetching ${targetYear} Fast & Furious Premium data from ${URL}…`);
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  // Find all tables - since we're on year-specific page, all tables belong to this year
  const allTables = $('table.wikitable');
  const tables = allTables;

  console.log(`Found ${tables.length} table(s) for ${targetYear}. Processing…`);

  if (tables.length === 0) {
    throw new Error(`Could not find any tables for ${targetYear} on the page ${URL}`);
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  // Ensure the Collection record exists for "Fast & Furious Premium"
  const collectionName = 'Fast & Furious Premium';
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

  // In-memory caches
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();

  let totalProcessed = 0;
  let totalCreated = 0;

  // Process each table (each sub-series)
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    // Skip generic or invalid names (no specific exclusions for 2021)
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    // Get rows from tbody
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Toy #, Col#, Casting Name
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      const {
        toyNumber,
        collectorNumber,
        castingName,
        bodyColor,
        wheelType,
        notes,
        castingNameLink,
      } = parsePremiumWikiRowForImport($, cells);

      if (!toyNumber || !collectorNumber || !castingName) {
        console.warn(
          `Skipping row with missing data: Toy#=${toyNumber}, Col#=${collectorNumber}, Name=${castingName}`,
        );
        continue;
      }

      // Lookup or create SubSeries
      let subSeries = subSeriesCache.get(subSeriesName);
      if (!subSeries) {
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

      // Model key: castingName + subSeries for uniqueness
      const modelKey = `${castingName}_${subSeriesName}`;
      let model = modelCache.get(modelKey);
      
      if (!model) {
        // Check if model exists
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: castingName,
            subSeriesId: subSeries.id,
          },
        });
        
        if (existingModel) {
          model = { id: existingModel.id };
        } else {
          // Fetch model metadata if not cached
          let metadata = modelMetadataCache.get(castingName);
          if (!metadata) {
            // Extract model page URL from link
            const modelPageHref = castingNameLink.attr('href');
            if (modelPageHref) {
              const modelUrl = modelPageHref.startsWith('http')
                ? modelPageHref
                : `https://hotwheels.fandom.com${modelPageHref}`;
              
              console.log(`Fetching metadata for ${castingName}...`);
              metadata = await fetchFandomModelMetadata(modelUrl);
              modelMetadataCache.set(castingName, metadata);
              
              // Rate limiting - wait a bit between requests
              await sleep(500);
            } else {
              metadata = {
                debutSeries: null,
                produced: null,
                designer: null,
                castingNumber: null,
                description: null,
              };
            }
          }
          
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber,
              description: metadata.description,
              debutSeries: metadata.debutSeries,
              produced: metadata.produced,
              designer: metadata.designer,
              castingNumber: metadata.castingNumber,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: collectorNumber,
          color: bodyColor || undefined,
          year: targetYear,
        },
      });
      
      if (existingVariant) {
        continue;
      }

      // Create Variant - Fast & Furious Premium has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: subSeriesName,
          color: bodyColor || undefined,
          cardNumber: collectorNumber,
          wheelType: wheelType || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: notes || undefined,
          owned: false,
          quantity: 0,
        },
      });
      
      totalCreated++;
      totalProcessed++;
    }
  }

  console.log(`\nImport completed. Processed ${totalProcessed} rows, created ${totalCreated} new variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

