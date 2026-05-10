/**
 * Script to import the 2018 Pearl&Chrome Anniversary Series (50th Anniversary Black and Gold Series)
 * into your database using Prisma.
 *
 * This script fetches the 50th Anniversary Black and Gold Series table from the Hot Wheels Fandom wiki,
 * parses each row to extract model information, and writes the data into the
 * corresponding Prisma models: Year → Collection → SubSeries → Model → Variant.
 *
 * Table structure:
 *   Column 0: Col # (Series #, e.g., 1/6, 2/6)
 *   Column 1: Toy # (Card Number, e.g., FRN34, FRN35)
 *   Column 2: Casting Name
 *   Column 3: Color
 *   Column 4: Tampo
 *   Column 5: Wheel Type
 *   Column 6: Notes
 *   Column 7: Photo Loose
 *   Column 8: Photo Carded
 *
 * How to use:
 *   npx ts-node scripts/import/import_pearl_chrome_anniversary_2018.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/50th_Anniversary_Black_and_Gold_Series_(2018)';
const YEAR = 2018;
const COLLECTION_NAME = 'Pearl&Chrome Anniversary Series';
const SUB_SERIES_NAME = '50th Anniversary Black and Gold Series';

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
 * Format description for Model.description field
 */
function formatDescription(color: string, tampo: string, wheelType: string, notes: string): string {
  const parts: string[] = [];
  if (color) parts.push(`Color: ${color}`);
  if (tampo) parts.push(`Tampo: ${tampo}`);
  if (wheelType) parts.push(`Wheel Type: ${wheelType}`);
  if (notes) parts.push(`Notes: ${notes}`);
  return parts.join('\n');
}

async function main() {
  console.log(`Fetching ${SUB_SERIES_NAME} data for ${YEAR}…`);
  
  let html: string;
  try {
    html = await fetchWithRetry(URL);
  } catch (error) {
    console.error(`Failed to fetch ${URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find the main table (wikitable)
  const table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the main table on the page');
  }

  // Ensure the Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: YEAR } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: YEAR } });
    console.log(`Created Year record for ${YEAR}`);
  }

  // Ensure the Collection record exists
  let collectionRecord = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: COLLECTION_NAME,
        code: COLLECTION_NAME,
        year: {
          connect: { id: yearRecord.id },
        },
      },
    });
    console.log(`Created Collection record for ${COLLECTION_NAME}`);
  }

  // Ensure the SubSeries record exists
  let subSeriesRecord = await prisma.subSeries.findFirst({
    where: {
      name: SUB_SERIES_NAME,
      collectionId: collectionRecord.id,
    },
  });
  if (!subSeriesRecord) {
    subSeriesRecord = await prisma.subSeries.create({
      data: {
        name: SUB_SERIES_NAME,
        collection: { connect: { id: collectionRecord.id } },
      },
    });
    console.log(`Created SubSeries record for ${SUB_SERIES_NAME}`);
  }

  // Process table rows
  const rows = table.find('tbody tr');
  console.log(`Found ${rows.length} rows. Processing…`);

  let createdCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue; // skip header or empty rows

    // Extract data from cells
    const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
    const cardNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const castingName = cells.length > 2 ? $(cells[2]).text().trim() : '';
    const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
    const tampo = cells.length > 4 ? $(cells[4]).text().trim() : '';
    const wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
    const notes = cells.length > 6 ? $(cells[6]).text().trim() : '';

    // Skip if essential data is missing
    if (!cardNumber || !castingName) {
      console.warn(`Skipping row ${i + 1}: missing cardNumber or castingName`);
      skippedCount++;
      continue;
    }

    // Clean casting name (remove wiki links if present)
    const cleanCastingName = castingName.replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();

    // Format description
    const description = formatDescription(color, tampo, wheelType, notes);

    // Find or create Model
    let model = await prisma.model.findFirst({
      where: {
        castingName: cleanCastingName,
        subSeriesId: subSeriesRecord.id,
      },
    });

    if (!model) {
      model = await prisma.model.create({
        data: {
          castingName: cleanCastingName,
          description: description,
          collection: { connect: { id: collectionRecord.id } },
          subSeries: { connect: { id: subSeriesRecord.id } },
        },
      });
      console.log(`Created Model: ${cleanCastingName}`);
    } else {
      // Update description if it exists
      if (description) {
        await prisma.model.update({
          where: { id: model.id },
          data: { description: description },
        });
      }
    }

    // Check if variant already exists
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: cardNumber,
        year: YEAR,
      },
    });

    if (existingVariant) {
      console.log(`Variant already exists: ${cleanCastingName} (${cardNumber})`);
      skippedCount++;
      continue;
    }

    // Create Variant
    await prisma.variant.create({
      data: {
        model: { connect: { id: model.id } },
        year: YEAR,
        cardNumber: cardNumber,
        color: color || undefined,
        wheelType: wheelType || undefined,
        notes: notes || undefined,
      },
    });

    createdCount++;
    console.log(`Created Variant: ${cleanCastingName} (${cardNumber})`);
  }

  console.log(`\n=== Import completed ===`);
  console.log(`  - Variants created: ${createdCount}`);
  console.log(`  - Variants skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
