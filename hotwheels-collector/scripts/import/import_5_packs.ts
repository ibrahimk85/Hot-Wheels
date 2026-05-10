/**
 * Script to import Hot Wheels 5-Packs set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 5-Packs page from Hot Wheels Fandom wiki for the specified year
 *   2. Parses the table to extract Package#, Year, Name, Vehicles, and Photo
 *   3. Creates database records: Year → Collection (Hot Wheels 5-Packs) → Model → Variant
 *
 * Table columns (0-based index):
 * 0: Package# (can have multiple, use first one)
 * 1: Year
 * 2: Name (5-Pack name - Model name)
 * 3: Vehicles (list of vehicles - Model description)
 * 4: Notes (optional)
 * 5: Photo (main image - will be handled by download script)
 *
 * How to use:
 *   # Import for a specific year
 *   npx ts-node scripts/import/import_5_packs.ts 2025
 *
 *   # Import for multiple years (2020-2025)
 *   npx ts-node scripts/import/import_5_packs.ts 2020 2021 2022 2023 2024 2025
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a name into a safe slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

async function processYear(targetYear: number) {
  const URL = `https://hotwheels.fandom.com/wiki/${targetYear}_5-Packs`;
  console.log(`\n=== Processing Year ${targetYear} ===`);
  console.log(`Fetching ${targetYear} 5-Packs data from ${URL}…`);
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

  // Find the main table (first wikitable)
  const table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    throw new Error(`Could not find the 5-Packs table on the page ${URL}`);
  }

  console.log('Found table. Processing…');

  // Ensure Year record exists
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  // Ensure Collection record exists
  const collectionName = 'Hot Wheels 5-Packs';
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

  // Get all rows from tbody
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 4; // At least Package#, Year, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows. Processing…`);

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
    
    // Column 1: Year
    const yearCell = $(cells[1]).text().trim();
    const year = parseInt(yearCell, 10);
    
    // Column 2: Name (5-Pack name)
    const nameCell = $(cells[2]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 3: Vehicles (list of vehicles)
    const vehiclesCell = $(cells[3]);
    const vehiclesText = vehiclesCell.text().trim();
    
    // Column 4: Notes (optional)
    const notesCell = cells.length > 4 ? $(cells[4]).text().trim() : '';
    
    // Column 5: Photo (will be handled by download script)
    // We don't need to extract it here

    // Validate required fields
    if (!packageNumber || !name || !vehiclesText) {
      console.warn(`Skipping row ${i + 1}: missing required data (Package#: ${packageNumber}, Name: ${name}, Vehicles: ${vehiclesText ? 'present' : 'missing'})`);
      skippedCount++;
      continue;
    }

    // Validate year matches target year
    if (year !== targetYear) {
      console.warn(`Skipping row ${i + 1}: year mismatch (${year} != ${targetYear})`);
      skippedCount++;
      continue;
    }

    // Check if Model already exists
    let model = await prisma.model.findFirst({
      where: {
        castingName: name,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      // Create Model with Vehicles as description
      const description = vehiclesText || null;
      
      model = await prisma.model.create({
        data: {
          castingName: name,
          description: description,
          collection: { connect: { id: collectionRecord.id } },
        },
      });
      console.log(`Created Model: ${name}`);
    }

    // Check if Variant already exists
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: packageNumber,
        year: targetYear,
      },
    });

    if (!existingVariant) {
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          cardNumber: packageNumber,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          owned: false,
          quantity: 0,
          notes: notesCell || undefined,
        },
      });
      totalCreated++;
      console.log(`Created Variant: ${name} (Package#: ${packageNumber})`);
    } else {
      console.log(`Variant already exists: ${name} (Package#: ${packageNumber})`);
    }

    totalProcessed++;
    
    // Small delay to avoid overwhelming the database
    if (i % 10 === 0) {
      await sleep(100);
    }
  }

  console.log(`\n=== Year ${targetYear} Import completed ===`);
  console.log(`  - Processed: ${totalProcessed} rows`);
  console.log(`  - Created: ${totalCreated} new variants`);
  console.log(`  - Skipped: ${skippedCount} rows`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Please provide at least one year as argument.');
    console.error('Usage: npx ts-node scripts/import/import_5_packs.ts <year1> [year2] [year3] ...');
    console.error('Example: npx ts-node scripts/import/import_5_packs.ts 2025');
    console.error('Example: npx ts-node scripts/import/import_5_packs.ts 2020 2021 2022 2023 2024 2025');
    process.exit(1);
  }

  const years = args.map(arg => parseInt(arg, 10)).filter(year => !isNaN(year) && year >= 2000 && year <= 2100);
  
  if (years.length === 0) {
    console.error('No valid years provided. Please provide years between 2000 and 2100.');
    process.exit(1);
  }

  console.log(`Processing years: ${years.join(', ')}`);

  for (const year of years) {
    try {
      await processYear(year);
    } catch (error) {
      console.error(`Error processing year ${year}:`, error);
    }
  }

  console.log('\n=== All imports completed ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
