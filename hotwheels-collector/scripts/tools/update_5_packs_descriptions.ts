/**
 * Script to update Model and Variant descriptions with Vehicles and Notes information
 * from the 5-Packs wiki pages.
 * 
 * This script:
 *   1. Fetches each year's 5-Packs page (2010-2026)
 *   2. Extracts Vehicles (Column 3) and Notes (Column 4) information
 *   3. Updates Model.description with Vehicles + Notes
 *   4. Updates Variant.notes with Vehicles + Notes
 * 
 * Usage:
 *   npx ts-node scripts/tools/update_5_packs_descriptions.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract first package number from a string that may contain multiple package numbers
 */
function extractFirstPackageNumber(packageNumberCell: string): string | null {
  if (!packageNumberCell) return null;
  
  const parts = packageNumberCell.trim().split(/\s+/);
  if (parts.length > 0 && parts[0]) {
    return parts[0].trim();
  }
  
  return null;
}

/**
 * Combine Vehicles and Notes into a description string
 */
function combineDescription(vehicles: string, notes: string): string {
  const parts: string[] = [];
  
  if (vehicles && vehicles.trim()) {
    parts.push(vehicles.trim());
  }
  
  if (notes && notes.trim()) {
    parts.push(notes.trim());
  }
  
  return parts.join('\n\n').trim() || '';
}

async function processYear(targetYear: number) {
  const URL = `https://hotwheels.fandom.com/wiki/${targetYear}_5-Packs`;
  console.log(`\n=== Processing Year ${targetYear} ===`);
  console.log(`Fetching ${targetYear} 5-Packs data from ${URL}…`);
  
  let response: Response | null = null;
  let html = '';
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
      }
      
      html = await response.text();
      
      // Check if we got a bot challenge page
      if (html.length < 1000 || html.includes('Client Challenge') || html.includes('Just a moment')) {
        throw new Error('Received bot challenge page');
      }
      
      break; // Success, exit retry loop
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed, retrying in ${attempt * 2000}ms...`);
      await sleep(attempt * 2000);
    }
  }
  
  if (!html) {
    throw new Error(`Failed to fetch ${URL} after ${maxRetries} attempts`);
  }
  
  const $ = cheerio.load(html);

  // Find the main table - try multiple selectors
  let table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    // Try alternative selector
    table = $('table').first();
  }
  if (!table || table.length === 0) {
    console.warn(`Could not find the 5-Packs table on the page ${URL}`);
    return;
  }

  console.log('Found table. Processing…');

  // Get Collection record
  const collectionName = 'Hot Wheels 5-Packs';
  const yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  
  if (!yearRecord) {
    console.warn(`Year ${targetYear} not found in database. Skipping...`);
    return;
  }

  const collectionRecord = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      yearId: yearRecord.id,
    },
  });

  if (!collectionRecord) {
    console.warn(`Collection "${collectionName}" not found for year ${targetYear}. Skipping...`);
    return;
  }

  // Get all rows from tbody
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 4; // At least Package#, Year, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows. Processing…`);

  let totalUpdated = 0;
  let totalSkipped = 0;

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

    // Validate required fields
    if (!packageNumber || !name || !vehiclesText) {
      console.warn(`Skipping row ${i + 1}: missing required data (Package#: ${packageNumber}, Name: ${name})`);
      totalSkipped++;
      continue;
    }

    // Validate year matches target year
    if (year !== targetYear) {
      console.warn(`Skipping row ${i + 1}: year mismatch (${year} != ${targetYear})`);
      totalSkipped++;
      continue;
    }

    // Find Model
    const model = await prisma.model.findFirst({
      where: {
        castingName: name,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      console.warn(`Model not found: ${name} (Package#: ${packageNumber})`);
      totalSkipped++;
      continue;
    }

    // Find Variant
    const variant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: packageNumber,
        year: targetYear,
      },
    });

    if (!variant) {
      console.warn(`Variant not found: ${name} (Package#: ${packageNumber})`);
      totalSkipped++;
      continue;
    }

    // Combine Vehicles and Notes
    const description = combineDescription(vehiclesText, notesCell);

    // Update Model description
    if (description) {
      await prisma.model.update({
        where: { id: model.id },
        data: { description: description },
      });
      console.log(`Updated Model description: ${name}`);
    }

    // Update Variant notes
    if (description) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { notes: description },
      });
      console.log(`Updated Variant notes: ${name} (Package#: ${packageNumber})`);
    }

    totalUpdated++;
    
    // Small delay to avoid overwhelming the database
    if (i % 10 === 0) {
      await sleep(100);
    }
  }

  console.log(`\n=== Year ${targetYear} Update completed ===`);
  console.log(`  - Updated: ${totalUpdated} records`);
  console.log(`  - Skipped: ${totalSkipped} rows`);
}

async function main() {
  const args = process.argv.slice(2);
  
  let years: number[] = [];
  
  if (args.length > 0) {
    // Use provided years
    years = args.map(arg => parseInt(arg, 10)).filter(year => !isNaN(year) && year >= 2000 && year <= 2100);
  } else {
    // Default: all years from 2010 to 2026
    for (let year = 2010; year <= 2026; year++) {
      years.push(year);
    }
  }
  
  if (years.length === 0) {
    console.error('No valid years provided.');
    process.exit(1);
  }

  console.log(`Processing years: ${years.join(', ')}`);

  for (const year of years) {
    try {
      await processYear(year);
      // Add delay between years to avoid rate limiting
      await sleep(2000);
    } catch (error) {
      console.error(`Error processing year ${year}:`, error);
    }
  }

  console.log('\n=== All updates completed ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
