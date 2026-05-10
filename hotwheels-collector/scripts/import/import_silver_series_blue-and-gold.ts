/**
 * Script to import the Blue and Gold Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches Blue and Gold Series page from Hot Wheels Fandom wiki
 *   2. Parses the table for each year (2016, 2018, 2020, 2022, 2024)
 *   3. Extracts data: Series #, Toy #, Casting Name, Body Color, Tampo, Wheel Type, Base Code
 *   4. Creates database records: Year → Collection (Blue and Gold) → SubSeries → Model → Variant
 *
 * Blue and Gold Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Blue and Gold (2016, 2018, 2020, 2022, 2024)
 * - Toy # is used as both cardNumber and toyNumber for matching
 * - Series # is stored in Model.seriesNumber
 * - Tampo is stored in Model.description
 * - Base Code(s) is stored in Variant.notes
 *
 * How to use:
 *   # Import single year
 *   npx ts-node scripts/import/import_stars_stripes.ts 2024
 *
 *   # Import all years (2016, 2018, 2020, 2022, 2024)
 *   npx ts-node scripts/import/import_stars_stripes.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Toy # (HRW62, etc.) is used as both cardNumber and toyNumber
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// Years to process
const YEARS = [2026];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a casting name into a safe folder slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch with retry mechanism to handle bot challenges
 */
async function fetchWithRetry(url: string, retries = 5, delay = 10000): Promise<string> {
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
      if (!html.includes('wikitable') && !html.includes('Stars') && !html.includes('Stripes')) {
        throw new Error('Page content does not match expected structure');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms (${Math.round(delay/1000)}s) before retry…`);
        await sleep(delay);
        delay *= 2; // Exponential backoff (10s -> 20s -> 40s -> 80s -> 160s)
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

/**
 * Process a single year's data
 */
async function processYear(year: number) {
  console.log(`\n=== Processing Year ${year} ===`);

  // Build wiki URL - all years are on the same page
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Blue_and_Gold_Series`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find all tables
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    // Try alternative selector
    const altTables = $('table');
    if (altTables.length === 0) {
      console.error(`Could not find any tables on ${wikiUrl}`);
      return;
    }
    console.log(`Found ${altTables.length} table(s) (without .wikitable class)`);
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year } });
    console.log(`Created Year record for ${year}`);
  }

  // Ensure the Collection record exists for "Blue and Gold"
  const collectionName = 'Blue and Gold';
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

  // Find the year heading and get tables for that year
  let tablesToProcess;
  
  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(year)) && !text.includes(String(year - 1)) && !text.includes(String(year + 1));
  }).first();

  if (yearHeading.length > 0) {
    // Find all tables after year heading until next year heading
    const nextYearHeading = yearHeading.nextAll('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return /^\d{4}/.test(text) && !text.includes(String(year));
    }).first();

    if (nextYearHeading.length > 0) {
      tablesToProcess = yearHeading.nextUntil(nextYearHeading).filter('table.wikitable');
    } else {
      tablesToProcess = yearHeading.nextAll('table.wikitable');
    }
    console.log(`Found ${tablesToProcess.length} table(s) under "${year}" heading for year ${year}`);
  } else {
    // Fallback: try to find table by year in content
    tablesToProcess = tables.filter((_, table) => {
      const tableText = $(table).text();
      return tableText.includes(String(year));
    });
    
    if (tablesToProcess.length === 0) {
      tablesToProcess = tables;
    }
    console.log(`Found ${tablesToProcess.length} table(s) for year ${year} (fallback method)`);
  }

  // In-memory caches
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // SubSeries name is the year
  const subSeriesName = String(year);

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

  // Process the target table(s)
  for (let tableIndex = 0; tableIndex < tablesToProcess.length; tableIndex++) {
    const tableElement = tablesToProcess[tableIndex];
    const table = $(tableElement);
    
    // Get rows from tbody
    const rows = table.find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Series #, Toy #, Casting Name
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName} (table ${tableIndex + 1})`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Table structure for Blue and Gold:
      // Column 0: Series # (1/5, 2/5, etc.)
      // Column 1: Toy # (HRW62, HRW63, etc.)
      // Column 2: Casting Name
      // Column 3: Body Color
      // Column 4: Tampo
      // Column 5: Wheel Type
      // Column 6: Notes (Base code(s): T06, etc.)
      // Column 7: Photo Loose
      // Column 8: Photo Carded

      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : ''; // Series #
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : ''; // Toy #
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : ''; // Casting Name
      const bodyColorRaw = cells.length > 3 ? $(cells[3]).text().trim() : ''; // Body Color
      const tampoRaw = cells.length > 4 ? $(cells[4]).text().trim() : ''; // Tampo
      const wheelTypeRaw = cells.length > 5 ? $(cells[5]).text().trim() : ''; // Wheel Type
      const notesRaw = cells.length > 6 ? $(cells[6]).text().trim() : ''; // Notes (Base code(s))

      // Extract Series # (e.g., "1/5", "2/5")
      const seriesNumber = cell0 || undefined;

      // Extract Toy # (e.g., "HRW62")
      let toyNumber: string | null = null;
      let castingNameRaw: string = '';
      
      // Extract toy number from cell1 (e.g., "HRW62")
      const cell1ToyMatch = cell1.match(/^([A-Z]{3}\d{2,3})$/);
      if (cell1ToyMatch) {
        toyNumber = cell1ToyMatch[1];
        castingNameRaw = cell2; // Casting name is in column 2
      } else {
        // Try to extract from cell1 if it contains the pattern
        const cell1ToyMatch2 = cell1.match(/([A-Z]{3}\d{2,3})/);
        if (cell1ToyMatch2) {
          toyNumber = cell1ToyMatch2[1];
          castingNameRaw = cell2;
        }
      }

      if (!toyNumber || !castingNameRaw) {
        console.warn(`Skipping row with missing toy number or casting name (cell0: "${cell0}", cell1: "${cell1}", cell2: "${cell2}")`);
        totalSkipped++;
        continue;
      }

      const castingName = castingNameRaw.trim();
      const bodyColor = bodyColorRaw || undefined;
      const wheelType = wheelTypeRaw || undefined;
      
      // Build description with Tampo (for Model.description)
      const descriptionParts: string[] = [];
      if (tampoRaw) {
        descriptionParts.push(`Tampo: ${tampoRaw}`);
      }
      const modelDescription = descriptionParts.length > 0 ? descriptionParts.join('; ') : undefined;
      
      // Build notes with base code(s) (for Variant.notes)
      const notesParts: string[] = [];
      if (notesRaw) {
        // Parse "Base code(s): T06" format
        const baseCodeMatch = notesRaw.match(/Base code\(s\):\s*(.+)/i);
        if (baseCodeMatch) {
          notesParts.push(`Base code(s): ${baseCodeMatch[1].trim()}`);
        } else {
          // If format is different, just add the raw notes
          notesParts.push(notesRaw);
        }
      }
      const variantNotes = notesParts.length > 0 ? notesParts.join('; ') : undefined;

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
          // Update description if Tampo info exists
          // If model already has description, append Tampo if it's not already there
          if (modelDescription) {
            if (!existingModel.description) {
              // No description yet, add Tampo
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: modelDescription },
              });
            } else if (!existingModel.description.includes('Tampo:')) {
              // Has description but no Tampo, append it
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: `${existingModel.description}; ${modelDescription}` },
              });
            }
            // If description already contains Tampo, don't update (to avoid duplicates)
          }
          // Update seriesNumber if not set
          if (seriesNumber && !existingModel.seriesNumber) {
            await prisma.model.update({
              where: { id: existingModel.id },
              data: { seriesNumber: seriesNumber },
            });
          }
          model = { id: existingModel.id };
        } else {
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber, // Use toy number as castingId
              seriesNumber: seriesNumber, // Store Series # (e.g., "1/5")
              description: modelDescription, // Add Tampo information to description
              collection: { connect: { id: collectionRecord.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})${seriesNumber ? ` [${seriesNumber}]` : ''}${modelDescription ? ` - ${modelDescription}` : ''}`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          year: year,
          toyNumber: toyNumber,
        },
      });
      
      totalProcessed++;
      
      if (existingVariant) {
        totalSkipped++;
        continue;
      }

      // Create Variant - Blue and Gold has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: year,
          releaseName: subSeriesName,
          color: bodyColor,
          wheelType: wheelType,
          cardNumber: toyNumber, // Use toy number as cardNumber
          toyNumber: toyNumber, // Use toy number as toyNumber for matching
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: variantNotes,
          owned: false,
          quantity: 0,
        },
      });
      
      totalCreated++;
    }
  }

  console.log(`\n=== Year ${year} completed ===`);
  console.log(`Processed ${totalProcessed} rows, created ${totalCreated} new variants, skipped ${totalSkipped} existing variants.`);
}

async function main() {
  // Get year from command line argument, or process all years
  const args = process.argv.slice(2);
  const yearsToProcess = args.length > 0 
    ? args.map(y => parseInt(y, 10)).filter(y => YEARS.includes(y))
    : YEARS;

  if (yearsToProcess.length === 0) {
    console.error('No valid years specified. Valid years: 2016, 2018, 2020, 2022, 2024');
    process.exit(1);
  }

  console.log(`Processing years: ${yearsToProcess.join(', ')}`);

  for (const year of yearsToProcess) {
    await processYear(year);
    // Small delay between years to avoid rate limiting
    if (yearsToProcess.indexOf(year) < yearsToProcess.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n=== Import completed ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
