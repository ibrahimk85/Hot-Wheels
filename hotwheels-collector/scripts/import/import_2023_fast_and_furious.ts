/**
 * Script to import the 2023 Hot Wheels Fast & Furious Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the Fast & Furious Series page from Hot Wheels Fandom wiki
 *   2. Parses the 2023 year table (filters by year heading)
 *   3. Extracts data: Series #, Casting Name, Color, Tampo, Wheel Type, Toy #, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Fast & Furious) → SubSeries → Model → Variant
 *
 * Fast & Furious Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Series 1, Series 2, Series 3, 10-Pack
 * - Model metadata from detail pages
 * - Single photo column (Photo Loose) - will be handled by image download script
 *
 * How to use:
 *   npx ts-node scripts/import/import_2023_fast_and_furious.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 *   - Only processes tables for year 2023
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2023;
const URL = `https://hotwheels.fandom.com/wiki/Fast_%26_Furious_Series_(${targetYear})`;

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
      subSeriesName = headingText.replace(/\[\]$/, ''); // Remove trailing []
    }
  }
  
  // Check table caption
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption.replace(/\[\]$/, '');
    }
  }
  
  // Check for span.mw-headline (Fandom wiki heading structure)
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText.replace(/\[\]$/, '');
      }
    }
  }
  
  // Default fallback
  return subSeriesName || 'Unknown Series';
}

async function main() {
  console.log(`Fetching ${targetYear} Fast & Furious Series data from ${URL}…`);
  const response = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find all tables - since we're on year-specific page, all tables belong to this year
  const allTables = $('table.wikitable');
  console.log(`Found ${allTables.length} table(s) for ${targetYear}. Processing…`);

  if (allTables.length === 0) {
    throw new Error(`Could not find any tables for ${targetYear} on the page ${URL}`);
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  // Ensure the Collection record exists for "Fast & Furious"
  const collectionName = 'Fast & Furious';
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
  let totalSkipped = 0;

  // Process each table (Series 1, Series 2, Series 3, 10-Pack)
  for (let tableIdx = 0; tableIdx < allTables.length; tableIdx++) {
    const table = allTables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    // Skip tables with generic or invalid names
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    // Check if this is 10-Pack table
    const is10Pack = subSeriesName.toLowerCase().includes('10-pack') || 
                     subSeriesName.toLowerCase().includes('10-car') ||
                     subSeriesName.toLowerCase().includes('pack');

    // Get rows from tbody
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Col #/Toy #, Casting Name, Color
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      let toyNumber: string | undefined;
      let collectorNumber: string | undefined;
      let castingNameLink: cheerio.Cheerio<any>;
      let color: string;
      let wheelType: string;
      let notes: string;

      if (is10Pack) {
        // 10-Pack table structure:
        // Column 0: Toy # (may be missing in some rows)
        // Column 1: Model Name (Casting Name) (link)
        // Column 2: Body Color
        // Column 3: Wheel Type
        // Column 4: Notes
        const toyNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
        // Check if first cell is actually a toy number (like HNT21) or casting name
        if (/^[A-Z]{2,3}\d{2,3}$/.test(toyNumberRaw)) {
          toyNumber = toyNumberRaw;
          castingNameLink = $(cells[1]).find('a').first();
          color = cells.length > 2 ? $(cells[2]).text().trim() : '';
          wheelType = cells.length > 3 ? $(cells[3]).text().trim() : '';
          notes = cells.length > 4 ? $(cells[4]).text().trim() : '';
        } else {
          // First cell is casting name, not toy number
          toyNumber = undefined;
          castingNameLink = $(cells[0]).find('a').first();
          color = cells.length > 1 ? $(cells[1]).text().trim() : '';
          wheelType = cells.length > 2 ? $(cells[2]).text().trim() : '';
          notes = cells.length > 3 ? $(cells[3]).text().trim() : '';
        }
        collectorNumber = undefined; // 10-Pack doesn't have Col #
      } else {
        // Series 1, 2, 3 table structure:
        // Column 0: Col # (Series #) - e.g., "1/10"
        // Column 1: Toy #
        // Column 2: Casting Name (link)
        // Column 3: Color
        // Column 4: Tampo
        // Column 5: Wheel Type
        // Column 6: Film Represented
        // Column 7: Notes
        const collectorNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
        // Parse series number from "1/10" format to just "1"
        if (collectorNumberRaw.includes('/')) {
          collectorNumber = collectorNumberRaw.split('/')[0].trim();
        } else {
          collectorNumber = collectorNumberRaw;
        }
        toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
        castingNameLink = $(cells[2]).find('a').first();
        color = cells.length > 3 ? $(cells[3]).text().trim() : '';
        wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
        notes = cells.length > 7 ? $(cells[7]).text().trim() : '';
      }
      
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : (is10Pack 
          ? (toyNumber ? $(cells[1]).text().trim() : $(cells[0]).text().trim())
          : $(cells[2]).text().trim());

      if (!castingNameRaw) {
        console.warn(`Skipping row with missing casting name`);
        continue;
      }

      const castingName = castingNameRaw;
      const finalNotes = notes || undefined;

      // Lookup or create SubSeries
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
              castingId: toyNumber || undefined,
              description: metadata.description,
              debutSeries: metadata.debutSeries,
              produced: metadata.produced,
              designer: metadata.designer,
              castingNumber: metadata.castingNumber,
              collection: { connect: { id: collectionRecord.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      const variantWhere: any = {
        modelId: model.id,
        year: targetYear,
        releaseName: subSeriesName,
      };
      
      if (collectorNumber) {
        variantWhere.cardNumber = collectorNumber;
      } else {
        variantWhere.cardNumber = null;
      }
      
      if (color && color.trim() !== '') {
        variantWhere.color = color.trim();
      } else {
        variantWhere.color = null;
      }
      
      const existingVariant = await prisma.variant.findFirst({
        where: variantWhere,
      });
      
      totalProcessed++;
      
      if (existingVariant) {
        totalSkipped++;
        continue;
      }

      // Create Variant - Fast & Furious Series has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: subSeriesName,
          color: color || undefined,
          cardNumber: collectorNumber || undefined,
          wheelType: wheelType || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: finalNotes,
          owned: false,
          quantity: 0,
        },
      });
      
      totalCreated++;
    }
  }

  console.log(`\nImport completed. Processed ${totalProcessed} rows, created ${totalCreated} new variants, skipped ${totalSkipped} existing variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
