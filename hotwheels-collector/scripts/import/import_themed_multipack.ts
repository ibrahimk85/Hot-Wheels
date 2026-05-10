/**
 * Script to import Hot Wheels Themed Multipack set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the Themed Multipack page from Hot Wheels Fandom wiki
 *   2. Parses tables for years 2022-2026 (each year has its own table section)
 *   3. Extracts Package#, Name, Vehicles, Notes from each table
 *   4. Creates database records: Year → Collection (Hot Wheels Themed multipack) → Model → Variant
 *
 * Table columns (0-based index):
 * 0: Package# (can have multiple, use first one)
 * 1: Name (Multipack name - Model name)
 * 2: Vehicles (list of vehicles - Column 3)
 * 3: Notes (optional - Column 4)
 * 4: Photo (main image - Column 5, will be handled by download script)
 *
 * How to use:
 *   npx ts-node scripts/import/import_themed_multipack.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

const TARGET_YEARS = [2022, 2023, 2024, 2025, 2026];
const COLLECTION_NAME = 'Hot Wheels Themed multipack';
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Themed_multipack';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract first package number from a string that may contain multiple package numbers
 */
function extractFirstPackageNumber(packageNumberCell: string): string | null {
  if (!packageNumberCell) return null;
  
  // Split by whitespace and take the first one
  const parts = packageNumberCell.trim().split(/\s+/);
  if (parts.length > 0 && parts[0]) {
    return parts[0].trim();
  }
  
  return null;
}

/**
 * Fetch with retry mechanism to handle bot challenges
 */
async function fetchWithRetry(url: string, retries = 5): Promise<string> {
  let delay = 3000;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Check if we got a bot challenge page
      if (html.length < 1000 || html.includes('Client Challenge') || html.includes('Just a moment') || html.includes('Checking your browser')) {
        throw new Error('Received bot challenge page');
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
 * Process a single year's table
 */
async function processYear(year: number, $: cheerio.CheerioAPI) {
  console.log(`\n=== Processing Year ${year} ===`);

  // Find the year heading (h2, h3, or h4)
  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(year)) && !text.includes(String(year - 1)) && !text.includes(String(year + 1));
  }).first();

  if (yearHeading.length === 0) {
    console.warn(`Could not find heading for year ${year}`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  // Find the table after this heading, before the next year heading
  const nextYearHeading = yearHeading.nextAll('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return /^\d{4}/.test(text) && !text.includes(String(year));
  }).first();

  let table;
  if (nextYearHeading.length > 0) {
    // Find table between current year heading and next year heading
    table = yearHeading.nextUntil(nextYearHeading).filter('table.wikitable').first();
  } else {
    // Find first table after current year heading
    table = yearHeading.nextAll('table.wikitable').first();
  }

  if (!table || table.length === 0) {
    // Try alternative selector
    table = yearHeading.nextAll('table').first();
  }

  if (!table || table.length === 0) {
    console.warn(`Could not find table for year ${year}`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  console.log(`Found table for year ${year}. Processing…`);

  // Ensure Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: year } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: year } });
    console.log(`Created Year record for ${year}`);
  }

  // Ensure Collection record exists
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
    console.log(`Created Collection record for ${COLLECTION_NAME} (${year})`);
  }

  // Get all rows from tbody
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3; // At least Package#, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows for year ${year}. Processing…`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    // Extract data from columns (0-based index)
    // Column 0: Package#
    const packageNumberCell = $(cells[0]).text().trim();
    const packageNumber = extractFirstPackageNumber(packageNumberCell);
    
    // Column 1: Name (Multipack name)
    const nameCell = $(cells[1]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 2: Vehicles (list of vehicles)
    const vehiclesCell = cells.length > 2 ? $(cells[2]) : null;
    const vehiclesText = vehiclesCell ? vehiclesCell.text().trim() : '';
    
    // Column 3: Notes (optional)
    const notesCell = cells.length > 3 ? $(cells[3]).text().trim() : '';

    // Validate required fields
    if (!packageNumber || !name) {
      console.warn(`Skipping row ${i + 1} (Year ${year}): missing required data (Package#: ${packageNumber}, Name: ${name})`);
      skippedCount++;
      continue;
    }

    // Combine Vehicles and Notes for description
    const descriptionParts: string[] = [];
    if (vehiclesText && vehiclesText.trim()) {
      descriptionParts.push(vehiclesText.trim());
    }
    if (notesCell && notesCell.trim()) {
      descriptionParts.push(notesCell.trim());
    }
    const description = descriptionParts.join('\n\n').trim() || null;

    // Check if Model already exists
    let model = await prisma.model.findFirst({
      where: {
        castingName: name,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      // Create Model with Vehicles + Notes as description
      model = await prisma.model.create({
        data: {
          castingName: name,
          description: description,
          collection: { connect: { id: collectionRecord.id } },
        },
      });
      console.log(`Created Model: ${name} (Year: ${year})`);
    } else if (description && model.description !== description) {
      // Update description if it's different
      await prisma.model.update({
        where: { id: model.id },
        data: { description: description },
      });
      console.log(`Updated Model description: ${name} (Year: ${year})`);
    }

    // Check if Variant already exists (match by Package# and year)
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: packageNumber,
        year: year,
      },
    });

    if (!existingVariant) {
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: year,
          cardNumber: packageNumber,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          owned: false,
          quantity: 0,
          notes: description, // Store Vehicles + Notes in variant notes
        },
      });
      totalCreated++;
      console.log(`Created Variant: ${name} (Package#: ${packageNumber}, Year: ${year})`);
    } else {
      // Update notes if different
      if (description && existingVariant.notes !== description) {
        await prisma.variant.update({
          where: { id: existingVariant.id },
          data: { notes: description },
        });
        console.log(`Updated Variant notes: ${name} (Package#: ${packageNumber}, Year: ${year})`);
      } else {
        console.log(`Variant already exists: ${name} (Package#: ${packageNumber}, Year: ${year})`);
      }
    }

    totalProcessed++;
    
    // Small delay to avoid overwhelming the database
    if (i % 10 === 0) {
      await sleep(100);
    }
  }

  console.log(`\n=== Year ${year} Import completed ===`);
  console.log(`  - Processed: ${totalProcessed} rows`);
  console.log(`  - Created: ${totalCreated} new variants`);
  console.log(`  - Skipped: ${skippedCount} rows`);

  return { processed: totalProcessed, created: totalCreated, skipped: skippedCount };
}

async function main() {
  console.log(`\n=== Hot Wheels Themed Multipack Import ===`);
  console.log(`Fetching data from ${WIKI_URL}…`);
  
  let html: string;
  try {
    html = await fetchWithRetry(WIKI_URL);
  } catch (error) {
    console.error(`Failed to fetch ${WIKI_URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // Process each year
  for (const year of TARGET_YEARS) {
    const result = await processYear(year, $);
    totalProcessed += result.processed;
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  console.log(`\n=== All Years Import completed ===`);
  console.log(`  - Total Processed: ${totalProcessed} rows`);
  console.log(`  - Total Created: ${totalCreated} new variants`);
  console.log(`  - Total Skipped: ${totalSkipped} rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
