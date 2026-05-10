/**
 * Script to import the 2013 Hot Wheels Boulevard set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2013 Boulevard page from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (Mix 1, Mix 2, Mix 3, Mix 4)
 *   3. Extracts data: Toy #, Casting Name, Body Color, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Boulevard) → SubSeries (Mix1-4) → Model → Variant
 *
 * Boulevard-specific:
 * - No TH/STH (always false)
 * - SubSeries are Mix 1, Mix 2, Mix 3, Mix 4
 * - Model metadata from detail pages
 * - No Series # column - use Toy # as cardNumber
 * - No Wheel Type column
 *
 * How to use:
 *   npx ts-node scripts/import/import_2013_boulevard.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 *   - Navigation tables are skipped
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const targetYear = 2013;
const URL = 'https://hotwheels.fandom.com/wiki/2013_Hot_Wheels_Boulevard';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract model metadata from model detail page
 */
async function fetchModelMetadata(modelUrl: string): Promise<{
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
  description: string | null;
}> {
  try {
    const html = await fetchFandomWikiHtml(modelUrl);
    const $ = cheerio.load(html);
    
    // Find info box or table with metadata
    // Look for common patterns in Fandom wiki pages
    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    let description: string | null = null;
    
    // Try to find in infobox or table
    const infobox = $('.infobox, .wikitable').first();
    
    if (infobox.length > 0) {
      infobox.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();
          
          if (/debut|first.*appear/i.test(label)) {
            debutSeries = value || null;
          }
          if (/produced|years/i.test(label)) {
            produced = value || null;
          }
          if (/designer/i.test(label)) {
            designer = value || null;
          }
          if (/number|casting.*number/i.test(label)) {
            castingNumber = value || null;
          }
        }
      });
    }
    
    // Try to find description (usually in first paragraph after infobox)
    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) {
      description = descriptionPara;
    }
    
    return {
      debutSeries,
      produced,
      designer,
      castingNumber,
      description,
    };
  } catch (error) {
    console.warn(`Error fetching model metadata from ${modelUrl}:`, error);
    return {
      debutSeries: null,
      produced: null,
      designer: null,
      castingNumber: null,
      description: null,
    };
  }
}

/**
 * Extract Mix name from table context (heading before table)
 * 2013 uses numbered Mixes: "Mix 1", "Mix 2", "Mix 3", "Mix 4"
 */
function extractMixName($: cheerio.CheerioAPI, table: any): string {
  // Try to find heading before table
  let mixName = '';
  
  // Check previous h2, h3, h4 elements
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    // Match "Mix 1", "Mix 2", etc.
    const mixMatch = headingText.match(/mix\s*(\d+)/i);
    if (mixMatch) {
      mixName = `Mix ${mixMatch[1]}`;
    }
  }
  
  // Check table caption
  if (!mixName) {
    const caption = $(table).find('caption').text().trim();
    const mixMatch = caption.match(/mix\s*(\d+)/i);
    if (mixMatch) {
      mixName = `Mix ${mixMatch[1]}`;
    }
  }
  
  // Check if this is a valid data table (has "Toy #" header)
  const headerRow = $(table).find('thead tr, tbody tr').first();
  const firstHeader = headerRow.find('th, td').first().text().trim();
  
  // If not a data table, return empty to skip
  if (firstHeader !== 'Toy #') {
    return '';
  }
  
  // Default to Mix 1 if not found but has valid data table
  return mixName || 'Mix 1';
}

async function main() {
  console.log(`Fetching ${targetYear} Boulevard data from ${URL}…`);
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  // Find all tables - each Mix has its own table
  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s). Processing…`);

  if (tables.length === 0) {
    throw new Error(`Could not find any tables on the page ${URL}`);
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  // Ensure the Collection record exists for "Boulevard"
  const collectionName = 'Boulevard';
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

  // Process each table (each Mix)
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);
    
    // Skip if no mix name found or if it's a navigation table
    if (!mixName || /hot.*wheels.*boulevard/i.test(mixName)) {
      console.log(`Skipping table: ${mixName || 'unknown'}`);
      continue;
    }

    console.log(`\nProcessing ${mixName}…`);

    // Get rows from tbody
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Toy #, Casting Name, Body Color
    });

    console.log(`Found ${rows.length} rows in ${mixName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract data based on known column structure for 2013
      // Column 0: Toy #
      // Column 1: Casting Name (link)
      // Column 2: Body Color
      // Column 3: Notes
      // Column 4: Photo Loose (image - not used in import)
      // Column 5: Photo Carded (image - not used in import)
      const toyNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      
      // Casting Name is in a link in column 1
      const castingNameLink = $(cells[1]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[1]).text().trim();
      
      const bodyColor = cells.length > 2 ? $(cells[2]).text().trim() : '';
      const notes = cells.length > 3 ? $(cells[3]).text().trim() : '';

      if (!toyNumber || !castingNameRaw) {
        console.warn(`Skipping row with missing data: Toy#=${toyNumber}, Name=${castingNameRaw}`);
        continue;
      }

      const castingName = castingNameRaw;

      // Lookup or create SubSeries (Mix)
      let subSeries = subSeriesCache.get(mixName);
      if (!subSeries) {
        const existingSub = await prisma.subSeries.findFirst({
          where: {
            name: mixName,
            collectionId: collectionRecord!.id,
          },
        });
        if (existingSub) {
          subSeries = { id: existingSub.id };
        } else {
          const created = await prisma.subSeries.create({
            data: {
              name: mixName,
              collection: { connect: { id: collectionRecord!.id } },
            },
          });
          console.log(`Created SubSeries: ${mixName}`);
          subSeries = { id: created.id };
        }
        subSeriesCache.set(mixName, subSeries);
      }

      // Model key: castingName + subSeries for uniqueness
      const modelKey = `${castingName}_${mixName}`;
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
              metadata = await fetchModelMetadata(modelUrl);
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
          console.log(`Created Model: ${castingName} (${mixName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      // Use Toy # as cardNumber since there's no Series # column
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: toyNumber,
          color: bodyColor || undefined,
          year: targetYear,
        },
      });
      
      if (existingVariant) {
        continue;
      }

      // Create Variant - Boulevard has NO TH/STH
      // Use Toy # as cardNumber (no Series # exists)
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: mixName,
          color: bodyColor || undefined,
          cardNumber: toyNumber, // Use Toy # as cardNumber
          wheelType: undefined, // No Wheel Type column in 2013
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




