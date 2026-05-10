/**
 * Script to import the Neon Speeders Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches Neon Speeders Series page from Hot Wheels Fandom wiki
 *   2. Parses the table for each year (2023, 2024, 2025, 2026)
 *   3. Extracts data: Card Number, Casting Name, Color, Base Code
 *   4. Creates database records: Year → Collection (Neon Speeders) → SubSeries → Model → Variant
 *
 * Neon Speeders Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Mix 1, Mix 2, etc. (NS6 gibi kodlar temizlenecek)
 * - Card Number is used as both cardNumber and toyNumber for matching
 * - Base Code is stored in Variant.notes
 *
 * How to use:
 *   # Import single year
 *   npx ts-node scripts/import/import_neon_speeders.ts 2023
 *
 *   # Import all years (2023-2026)
 *   npx ts-node scripts/import/import_neon_speeders.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Card Number (JKX93, etc.) is used as both cardNumber and toyNumber
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// Years to process
const YEARS = [2023, 2024, 2025, 2026];

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
 * Clean SubSeries name by removing codes like "NS6" and brackets
 */
function cleanSubSeriesName(name: string): string {
  return name
    .replace(/NS\d+/gi, '') // Remove NS6, NS7, etc.
    .replace(/[\[\]]/g, '') // Remove brackets
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
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
      if (!html.includes('wikitable') && !html.includes('Neon Speeders')) {
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
 * Process a single year's data
 */
async function processYear(year: number) {
  console.log(`\n=== Processing Year ${year} ===`);

  // Build wiki URL - all years are on the same page (2023 page)
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Neon_Speeders_Series_(2023)`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find all tables - Neon Speeders page may have multiple tables for different mixes
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

  // Ensure the Collection record exists for "Neon Speeders"
  const collectionName = 'Neon Speeders';
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

  // For 2023, we only process the table under the "2023" heading
  // For 2024, we process all tables under "2024" heading (Mix 1, Mix 2, etc.)
  let tablesToProcess;
  
  if (year === 2023) {
    // Find the "2023" heading
    const heading2023 = $('h2, h3, h4').filter((_, el) => {
      return $(el).text().trim().includes('2023');
    }).first();

    let targetTable;
    if (heading2023.length > 0) {
      // Find the table immediately after the 2023 heading
      targetTable = heading2023.nextUntil('h2, h3, h4').filter('table.wikitable').first();
      if (targetTable.length === 0) {
        targetTable = heading2023.next('table.wikitable').first();
      }
      if (targetTable.length === 0) {
        targetTable = tables.first(); // Fallback to first table
      }
      console.log(`Found table under "2023" heading for year ${year}`);
    } else {
      targetTable = tables.first();
    }
    tablesToProcess = targetTable.length > 0 ? [targetTable] : tables;
  } else if (year === 2024 || year === 2025 || year === 2026) {
    // Find the year heading (2024 or 2025)
    const yearHeading = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return text.includes(String(year)) && !text.includes(String(year - 1));
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
      tablesToProcess = tables;
    }
  } else {
    // For other years, process all tables
    tablesToProcess = tables;
  }

  // In-memory caches
  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // Process the target table(s)
  for (let tableIndex = 0; tableIndex < tablesToProcess.length; tableIndex++) {
    const tableElement = tablesToProcess[tableIndex];
    const table = $(tableElement);
    
    // Determine sub-series name from table context
    let subSeriesName = '';
    if (year === 2023) {
      subSeriesName = '2023';
    } else {
      // Try to determine sub-series name from table context (Mix 1, Mix 2, etc.)
      const prevHeading = table.prevAll('h2, h3, h4, h5').first();
      if (prevHeading.length > 0) {
        const headingText = prevHeading.text().trim();
        // Check if heading is a year (like "2024"), if so, look for next heading
        if (/^\d{4}/.test(headingText) && headingText.includes(String(year))) {
          // This is the year heading, look for the next heading which should be Mix 1, Mix 2, etc.
          const mixHeading = prevHeading.nextUntil('table').filter('h3, h4, h5').first();
          if (mixHeading.length > 0) {
            subSeriesName = cleanSubSeriesName(mixHeading.text().trim());
          } else {
            subSeriesName = `Mix ${tableIndex + 1}`;
          }
        } else {
          subSeriesName = cleanSubSeriesName(headingText);
        }
      } else {
        const caption = table.find('caption').text().trim();
        if (caption) {
          subSeriesName = cleanSubSeriesName(caption);
        } else {
          subSeriesName = `Mix ${tableIndex + 1}`;
        }
      }
    }

    if (!subSeriesName || subSeriesName === '') {
      subSeriesName = year === 2023 ? '2023' : `Mix ${tableIndex + 1}`;
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
    const rows = table.find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Card Number, Casting Name, Color
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName} (table ${tableIndex + 1})`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Table structure for 2023:
      // Column 0: Series # (1/8, 2/8, etc.)
      // Column 1: Toy # / Card Number (HLH73, HLH74, etc.)
      // Column 2: Casting Name
      // Column 3: Color
      // Column 4: Tamposh
      // Column 5: Wheel Type
      // Column 6: Notes (Base Code, etc.)
      // Column 7: Photo Loose
      // Column 8: Photo Blacklight
      // Column 9: Photo Carded

      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : ''; // Series #
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : ''; // Toy # / Card Number
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : ''; // Casting Name
      const colorRaw = cells.length > 3 ? $(cells[3]).text().trim() : ''; // Color
      const tamposRaw = cells.length > 4 && (year === 2023 || year === 2024 || year === 2025) ? $(cells[4]).text().trim() : ''; // Tampos (only for 2023-2025)
      const baseCodeRaw = cells.length > 6 ? $(cells[6]).text().trim() : ''; // Notes (Base Code)

      // For 2023, card number is in cell1 (Toy # column)
      // Casting name is in cell2
      let cardNumber: string | null = null;
      let castingNameRaw: string = '';
      
      // Extract card number from cell1 (e.g., "HLH73")
      const cell1CardMatch = cell1.match(/^([A-Z]{3}\d{2,3})$/);
      if (cell1CardMatch) {
        cardNumber = cell1CardMatch[1];
        castingNameRaw = cell2; // Casting name is in column 2
      } else {
        // Try to extract from cell1 if it contains the pattern
        const cell1CardMatch2 = cell1.match(/([A-Z]{3}\d{2,3})/);
        if (cell1CardMatch2) {
          cardNumber = cell1CardMatch2[1];
          castingNameRaw = cell2;
        }
      }

      if (!cardNumber || !castingNameRaw) {
        console.warn(`Skipping row with missing card number or casting name (cell0: "${cell0}", cell1: "${cell1}", cell2: "${cell2}")`);
        totalSkipped++;
        continue;
      }

      const castingName = castingNameRaw.trim();
      const color = colorRaw || undefined;
      
      // Build description with Tampos (for Model.description)
      const descriptionParts: string[] = [];
      if (tamposRaw) {
        descriptionParts.push(`Tampos: ${tamposRaw}`);
      }
      const modelDescription = descriptionParts.length > 0 ? descriptionParts.join('; ') : undefined;
      
      // Build notes with base code (for Variant.notes)
      const notesParts: string[] = [];
      if (baseCodeRaw) {
        notesParts.push(`Base code: ${baseCodeRaw}`);
      }
      const notes = notesParts.length > 0 ? notesParts.join('; ') : undefined;

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
          // Update description if Tampos info exists
          // If model already has description, append Tampos if it's not already there
          if (modelDescription) {
            if (!existingModel.description) {
              // No description yet, add Tampos
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: modelDescription },
              });
            } else if (!existingModel.description.includes('Tampos:')) {
              // Has description but no Tampos, append it
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: `${existingModel.description}; ${modelDescription}` },
              });
            }
            // If description already contains Tampos, don't update (to avoid duplicates)
          }
          model = { id: existingModel.id };
        } else {
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: cardNumber, // Use card number as castingId
              description: modelDescription, // Add Tampos information to description
              collection: { connect: { id: collectionRecord.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})${modelDescription ? ` - ${modelDescription}` : ''}`);
        }
        modelCache.set(modelKey, model);
      }

      // Check if variant already exists (duplicate prevention)
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          year: year,
          cardNumber: cardNumber,
        },
      });
      
      totalProcessed++;
      
      if (existingVariant) {
        totalSkipped++;
        continue;
      }

      // Create Variant - Neon Speeders has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: year,
          releaseName: subSeriesName,
          color: color,
          cardNumber: cardNumber,
          toyNumber: cardNumber, // Use card number as toyNumber for matching
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: notes,
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
    console.error('No valid years specified. Valid years: 2023, 2024, 2025, 2026');
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
