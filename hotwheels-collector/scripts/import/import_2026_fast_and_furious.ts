/**
 * Script to import the 2026 Hot Wheels Fast & Furious Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches 2 Fast & Furious Series pages via fetchFandomWikiHtml (403-safe: render + MediaWiki parse API)
 *   2. Parses each page's wikitable using header-based column map (10 cols e.g. Dream Lineup 2026, or 11 with Film)
 *   3. Extracts data: Series #, Casting Name, Color, Tampo, Wheel Type, Toy #, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Fast & Furious) → SubSeries → Model → Variant
 *
 * Fast & Furious Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Tokyo Drift, Dream Lineup
 * - Model metadata from detail pages
 * - Photo Carded and Photo Loose columns - will be handled by image download script
 *
 * How to use:
 *   npx ts-node scripts/import/import_2026_fast_and_furious.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Model metadata is fetched from individual model pages (may take time)
 *   - Processes 2 separate URLs, each representing a different sub-series
 *   - Optional: FF_2026_SUBSERIES=Dream Lineup → only that sub-series URL
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import {
  fastAndFuriousSeriesColumnMapFromTable,
  parseFfSeriesTableRowForImport,
} from '../lib/fast-and-furious-series-wiki-table.ts';

const targetYear = 2026;

// 2 sub-series URLs
const URLS = [
  {
    url: 'https://hotwheels.fandom.com/wiki/The_Fast_and_the_Furious:_Tokyo_Drift_Series_(2026)',
    subSeriesName: 'Tokyo Drift',
  },
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_Dream_Lineup_Series_(2026)',
    subSeriesName: 'Dream Lineup',
  },
];

const ffSubFilter = process.env.FF_2026_SUBSERIES?.trim();
const URLS_TO_PROCESS = ffSubFilter
  ? URLS.filter((u) => u.subSeriesName === ffSubFilter)
  : URLS;
if (ffSubFilter && URLS_TO_PROCESS.length === 0) {
  throw new Error(`FF_2026_SUBSERIES="${ffSubFilter}" does not match Tokyo Drift or Dream Lineup`);
}

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

  if (ffSubFilter) {
    console.log(`\nFF_2026_SUBSERIES=${ffSubFilter} — processing ${URLS_TO_PROCESS.length} URL(s).`);
  }

  // Process each URL (each represents a different sub-series)
  for (const { url, subSeriesName } of URLS_TO_PROCESS) {
    console.log(`\n=== Processing ${subSeriesName} ===`);
    
    let html: string;
    try {
      html = await fetchFandomWikiHtml(url);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
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

    const colMap = fastAndFuriousSeriesColumnMapFromTable($, table);
    if (!colMap) {
      console.error(
        `Could not parse table headers (Series/Toy/Casting/…/Photo) on ${url} — check wiki layout.`,
      );
      continue;
    }
    console.log(
      `Table columns: loose=${colMap.loose} carded=${colMap.carded} notes=${colMap.notes} wheel=${colMap.wheel}${colMap.film != null ? ` film=${colMap.film}` : ''}`,
    );

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

      const parsed = parseFfSeriesTableRowForImport($, cells, colMap);
      if (!parsed) {
        console.warn(`Skipping row with missing casting name`);
        continue;
      }

      const {
        collectorNumber,
        toyNumber,
        castingName,
        color,
        wheelType,
        notes,
        castingNameLink,
      } = parsed;
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
