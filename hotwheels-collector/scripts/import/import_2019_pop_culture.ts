/**
 * Script to import the 2019 Hot Wheels Pop Culture set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2019 Pop Culture page from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (each sub-series has its own table)
 *   3. Extracts data: Toy #, Series #, Casting Name, Body Color, Wheel Type, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Pop Culture) → SubSeries → Model → Variant
 *
 * Pop Culture-specific:
 * - No TH/STH (always false)
 * - SubSeries names are extracted from headings before tables (varies by year)
 * - Model metadata from detail pages
 *
 * How to use:
 *   npx ts-node scripts/import/import_2019_pop_culture.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2019;
const URL = 'https://hotwheels.fandom.com/wiki/2019_Pop_Culture';

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
    const response = await fetch(modelUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch model page: ${modelUrl}`);
      return {
        debutSeries: null,
        produced: null,
        designer: null,
        castingNumber: null,
        description: null,
      };
    }
    
    const html = await response.text();
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
 * Extract sub-series name from table context (heading before table)
 * For Pop Culture, sub-series names vary (not standardized like Boulevard Mix)
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
  
  // Default fallback
  return subSeriesName || 'Unknown Series';
}

async function main() {
  console.log(`Fetching ${targetYear} Pop Culture data from ${URL}…`);
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find all tables - each sub-series has its own table
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

  // Ensure the Collection record exists for "Pop Culture"
  const collectionName = 'Pop Culture';
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
    
    // Skip tables with generic or invalid names
    if (/^(contents|references|see also|external links|categories|team transport)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    // Get rows from tbody
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Toy #, Series #, Casting Name
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract data based on known column structure
      // Column 0: Series #
      // Column 1: Toy #
      // Column 2: Casting Name (link)
      // Column 3: Theme
      // Column 4: Body Color
      // Column 5: Wheel Type
      // Column 6: Notes
      const seriesNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      
      // Casting Name is in a link in column 2
      const castingNameLink = $(cells[2]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[2]).text().trim();
      
      const theme = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const bodyColor = cells.length > 4 ? $(cells[4]).text().trim() : '';
      const wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
      const notes = cells.length > 6 ? $(cells[6]).text().trim() : '';

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        console.warn(`Skipping row with missing data: Toy#=${toyNumber}, Series#=${seriesNumber}, Name=${castingNameRaw}`);
        continue;
      }

      const castingName = castingNameRaw;

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
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: seriesNumber,
          color: bodyColor || undefined,
          year: targetYear,
        },
      });
      
      if (existingVariant) {
        continue;
      }

      // Create Variant - Pop Culture has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: subSeriesName,
          theme: theme || undefined,
          color: bodyColor || undefined,
          cardNumber: seriesNumber,
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

