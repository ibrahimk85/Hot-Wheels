/**
 * Script to import the Vintage Racing Club Series set into your database using Prisma.
 *
 * This script:
 *   1. Fetches Vintage Racing Club Series page from Hot Wheels Fandom wiki
 *   2. Parses the table for 2024 (Mix 1 and Mix 2)
 *   3. Extracts data: Series #, Toy #, Casting Name, Color, Tampos, Wheel Type, Base Code
 *   4. Creates database records: Year → Collection (Vintage Racing Club) → SubSeries → Model → Variant
 *
 * Vintage Racing Club Series-specific:
 * - No TH/STH (always false)
 * - SubSeries: Mix 1, Mix 2
 * - Toy # is used as both cardNumber and toyNumber for matching
 * - Series # is stored in Model.seriesNumber
 * - Tampos is stored in Model.description
 * - Base Code(s) is stored in Variant.notes
 *
 * How to use:
 *   npx ts-node scripts/import/import_vintage_racing_club.ts
 *
 * Notes:
 *   - The script is idempotent for Year, Collection, and SubSeries
 *   - Duplicate variant check: Variant oluşturmadan önce findFirst ile kontrol edilir
 *   - Toy # (HRV01, etc.) is used as both cardNumber and toyNumber
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// Year to process
const YEAR = 2024;

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
 * Clean SubSeries name by removing brackets and extra spaces
 */
function cleanSubSeriesName(name: string): string {
  return name
    .replace(/[\[\]]/g, '') // Remove brackets
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
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
      if (!html.includes('wikitable') && !html.includes('Vintage') && !html.includes('Racing')) {
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

async function main() {
  console.log(`\n=== Processing Vintage Racing Club ${YEAR} ===`);

  // Build wiki URL
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Vintage_Racing_Club_Series_(2024)`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    process.exit(1);
  }

  const $ = cheerio.load(html);

  // Find all tables
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    console.error(`Could not find any tables on ${wikiUrl}`);
    process.exit(1);
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: YEAR } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: YEAR } });
    console.log(`Created Year record for ${YEAR}`);
  }

  // Ensure the Collection record exists for "Vintage Racing Club"
  const collectionName = 'Vintage Racing Club';
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

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // Process each table (Mix 1 and Mix 2)
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const tableElement = tables[tableIndex];
    const table = $(tableElement);
    
    // Determine sub-series name from table context
    let subSeriesName = '';
    
    // Try to find heading before table (Mix 1, Mix 2, etc.)
    const prevHeading = table.prevAll('h2, h3, h4, h5').first();
    if (prevHeading.length > 0) {
      const headingText = prevHeading.text().trim();
      // Check if it's a Mix heading
      if (headingText.includes('Mix')) {
        subSeriesName = cleanSubSeriesName(headingText);
      } else {
        // Look for Mix in nearby headings
        const mixHeading = prevHeading.prevAll('h2, h3, h4, h5').filter((_, el) => {
          return $(el).text().trim().includes('Mix');
        }).first();
        if (mixHeading.length > 0) {
          subSeriesName = cleanSubSeriesName(mixHeading.text().trim());
        }
      }
    }
    
    // If no heading found, try table caption
    if (!subSeriesName) {
      const caption = table.find('caption').text().trim();
      if (caption && caption.includes('Mix')) {
        subSeriesName = cleanSubSeriesName(caption);
      }
    }
    
    // Fallback: use table index
    if (!subSeriesName) {
      subSeriesName = `Mix ${tableIndex + 1}`;
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
      return cells.length >= 3; // At least Series #, Toy #, Casting Name
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName} (table ${tableIndex + 1})`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Table structure for Vintage Racing Club:
      // Column 0: Series # (1/6, 2/6, etc.)
      // Column 1: Toy # (HRV01, HRV02, etc.)
      // Column 2: Casting Name
      // Column 3: Color
      // Column 4: Tampos
      // Column 5: Wheel Type
      // Column 6: Notes (Base code(s): S41, etc.)
      // Column 7: Photo Loose
      // Column 8: Photo Carded

      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : ''; // Series #
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : ''; // Toy #
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : ''; // Casting Name
      const colorRaw = cells.length > 3 ? $(cells[3]).text().trim() : ''; // Color
      const tamposRaw = cells.length > 4 ? $(cells[4]).text().trim() : ''; // Tampos
      const wheelTypeRaw = cells.length > 5 ? $(cells[5]).text().trim() : ''; // Wheel Type
      const notesRaw = cells.length > 6 ? $(cells[6]).text().trim() : ''; // Notes (Base code(s))

      // Extract Series # (e.g., "1/6", "2/6")
      const seriesNumber = cell0 || undefined;

      // Extract Toy # (e.g., "HRV01")
      let toyNumber: string | null = null;
      let castingNameRaw: string = '';
      
      // Extract toy number from cell1 (e.g., "HRV01")
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
      const color = colorRaw || undefined;
      const wheelType = wheelTypeRaw || undefined;
      
      // Build description with Tampos (for Model.description)
      const descriptionParts: string[] = [];
      if (tamposRaw) {
        descriptionParts.push(`Tampos: ${tamposRaw}`);
      }
      const modelDescription = descriptionParts.length > 0 ? descriptionParts.join('; ') : undefined;
      
      // Build notes with base code(s) (for Variant.notes)
      const notesParts: string[] = [];
      if (notesRaw) {
        // Parse "Base code(s): S41, S42" format
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
          // Update description if Tampos info exists
          if (modelDescription) {
            if (!existingModel.description) {
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: modelDescription },
              });
            } else if (!existingModel.description.includes('Tampos:')) {
              await prisma.model.update({
                where: { id: existingModel.id },
                data: { description: `${existingModel.description}; ${modelDescription}` },
              });
            }
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
              seriesNumber: seriesNumber, // Store Series # (e.g., "1/6")
              description: modelDescription, // Add Tampos information to description
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
          year: YEAR,
          toyNumber: toyNumber,
        },
      });
      
      totalProcessed++;
      
      if (existingVariant) {
        totalSkipped++;
        continue;
      }

      // Create Variant - Vintage Racing Club has NO TH/STH
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: YEAR,
          releaseName: subSeriesName,
          color: color,
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
