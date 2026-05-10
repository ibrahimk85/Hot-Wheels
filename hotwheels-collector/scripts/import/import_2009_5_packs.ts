/**
 * Script to import 2009 Hot Wheels 5-Packs set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2009 5-Packs page from Hot Wheels Fandom wiki
 *   2. Parses the table to extract Package#, Name, Vehicles, Notes, and Photo
 *   3. Creates database records: Year → Collection (Hot Wheels 5-Packs) → Model → Variant
 *
 * Table columns (0-based index) for 2009:
 * 0: Package# (can have multiple, use first one)
 * 1: Name (5-Pack name - Model name)
 * 2: Vehicles (list of vehicles - Column 3)
 * 3: Notes (optional - Column 4)
 * 4: Photo (main image - Column 5, will be handled by download script)
 *
 * Note: 2009 table does NOT have a Year column, so we use the targetYear parameter.
 *
 * How to use:
 *   npx ts-node scripts/import/import_2009_5_packs.ts
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

async function main() {
  const targetYear = 2009;
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
  let table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    // Try alternative selector
    table = $('table').first();
  }
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
  // For 2009, we need at least Package#, Name, Vehicles (3 columns minimum)
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3; // At least Package#, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows. Processing…`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    // Extract data from columns (0-based index) for 2009
    // Column 0: Package#
    const packageNumberCell = $(cells[0]).text().trim();
    const packageNumber = extractFirstPackageNumber(packageNumberCell);
    
    // Column 1: Name (5-Pack name)
    const nameCell = $(cells[1]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 2: Vehicles (list of vehicles) - this is Column 3 in the description
    const vehiclesCell = cells.length > 2 ? $(cells[2]) : null;
    const vehiclesText = vehiclesCell ? vehiclesCell.text().trim() : '';
    
    // Column 3: Notes (optional) - this is Column 4 in the description
    const notesCell = cells.length > 3 ? $(cells[3]).text().trim() : '';
    
    // Column 4: Photo (will be handled by download script)
    // We don't need to extract it here

    // Validate required fields
    if (!packageNumber || !name) {
      console.warn(`Skipping row ${i + 1}: missing required data (Package#: ${packageNumber}, Name: ${name})`);
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
      console.log(`Created Model: ${name}`);
    } else if (description && model.description !== description) {
      // Update description if it's different
      await prisma.model.update({
        where: { id: model.id },
        data: { description: description },
      });
      console.log(`Updated Model description: ${name}`);
    }

    // Check if Variant already exists (match by Package# and Name)
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
          notes: description, // Store Vehicles + Notes in variant notes
        },
      });
      totalCreated++;
      console.log(`Created Variant: ${name} (Package#: ${packageNumber})`);
    } else {
      // Update notes if different
      if (description && existingVariant.notes !== description) {
        await prisma.variant.update({
          where: { id: existingVariant.id },
          data: { notes: description },
        });
        console.log(`Updated Variant notes: ${name} (Package#: ${packageNumber})`);
      } else {
        console.log(`Variant already exists: ${name} (Package#: ${packageNumber})`);
      }
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
