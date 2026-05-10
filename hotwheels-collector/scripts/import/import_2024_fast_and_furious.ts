/**
 * Script to import the 2024 Hot Wheels Fast & Furious Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches 4 Fast & Furious Series pages from Hot Wheels Fandom wiki
 *   2. Parses each page's table
 *   3. Extracts data: Series #, Casting Name, Color, Tampo, Wheel Type, Toy #, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Fast & Furious) → SubSeries → Model → Variant
 *
 * Fast & Furious Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Women of Fast, HW Decades, Dominic Toretto, Racing Series
 * - Model metadata from detail pages
 * - Photo Carded and Photo Loose columns - will be handled by image download script
 *
 * How to use:
 *   npx ts-node scripts/import/import_2024_fast_and_furious.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 *   - Processes 4 separate URLs, each representing a different sub-series
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const targetYear = 2024;

// 4 sub-series URLs
const URLS = [
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_Women_of_Fast_Series_(2024)',
    subSeriesName: 'Women of Fast',
  },
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_HW_Decades_of_Fast_Series_(2024)',
    subSeriesName: 'HW Decades of Fast',
  },
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_Dominic_Toretto_Series_(2024)',
    subSeriesName: 'Dominic Toretto',
  },
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_Racing_Series_(2024)',
    subSeriesName: 'Racing Series',
  },
];

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry mechanism to handle bot challenges
 */
async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://hotwheels.fandom.com/'
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      // Check if we got a bot challenge page
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page (HTML too short or contains "Client Challenge")');
      }

      // Check if page contains expected content
      if (!html.includes('wikitable') && !html.includes('Fast & Furious')) {
        throw new Error('Page content does not match expected structure');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms before retry…`);
        await sleep(delay);
        delay *= 1.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
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

async function main() {
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

  // Process each URL (each represents a different sub-series)
  for (const { url, subSeriesName } of URLS) {
    console.log(`\n=== Processing ${subSeriesName} ===`);
    
    let html: string;
    try {
      html = await fetchWithRetry(url);
    } catch (error) {
      console.error(`Failed to fetch ${url} after retries:`, error);
      continue;
    }
    
    const $ = cheerio.load(html);

    // Find the main table (try multiple selectors)
    let table = $('table.wikitable').first();
    if (table.length === 0) {
      // Try alternative selectors
      table = $('table').first();
    }
    if (table.length === 0) {
      console.error(`Could not find table on ${url}`);
      // Debug: log available tables
      const allTables = $('table');
      console.error(`  Found ${allTables.length} table(s) on page (without .wikitable class)`);
      // Debug: save HTML for inspection
      const debugDir = path.join(process.cwd(), 'debug');
      await fs.promises.mkdir(debugDir, { recursive: true });
      const debugFile = path.join(debugDir, `debug_${subSeriesName.replace(/\s+/g, '_')}_${Date.now()}.html`);
      await fs.promises.writeFile(debugFile, html, 'utf8');
      console.error(`  HTML saved to ${debugFile} for inspection`);
      continue;
    }

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

    // Get rows from tbody
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Col #, Casting Name, Color
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // 2024 table structure:
      // Column 0: Col # (Series #) - e.g., "1/5"
      // Column 1: Toy #
      // Column 2: Casting Name (link)
      // Column 3: Color
      // Column 4: Tampo
      // Column 5: Base Color / Type
      // Column 6: Wheel Type
      // Column 7: Film Represented
      // Column 8: Notes
      // Column 9: Photo Loose
      // Column 10: Photo Carded
      
      const collectorNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
      // Parse series number from "1/5" format to just "1"
      let collectorNumber: string | undefined;
      if (collectorNumberRaw.includes('/')) {
        collectorNumber = collectorNumberRaw.split('/')[0].trim();
      } else {
        collectorNumber = collectorNumberRaw || undefined;
      }
      
      const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const castingNameLink = $(cells[2]).find('a').first();
      const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const wheelType = cells.length > 6 ? $(cells[6]).text().trim() : '';
      const notes = cells.length > 8 ? $(cells[8]).text().trim() : '';
      
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[2]).text().trim();

      if (!castingNameRaw) {
        console.warn(`Skipping row with missing casting name`);
        continue;
      }

      const castingName = castingNameRaw;
      const finalNotes = notes || undefined;

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

  console.log(`\n=== Import completed ===`);
  console.log(`Processed ${totalProcessed} rows, created ${totalCreated} new variants, skipped ${totalSkipped} existing variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
