/**
 * Script to update Model and Variant descriptions with Vehicles and Notes information
 * from the 2009 5-Packs wiki page.
 * 
 * This script:
 *   1. Fetches the 2009 5-Packs page
 *   2. Extracts Vehicles (Column 2) and Notes (Column 3) information
 *   3. Updates Model.description with Vehicles + Notes
 *   4. Updates Variant.notes with Vehicles + Notes
 * 
 * Table structure for 2009:
 * Column 0: Package#
 * Column 1: Name
 * Column 2: Vehicles
 * Column 3: Notes
 * Column 4: Photo
 * 
 * Usage:
 *   npx ts-node scripts/tools/update_2009_5_packs_descriptions.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();
const targetYear = 2009;

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
      if (attempt < retries) {
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 1.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('All retry attempts failed');
}

async function main() {
  const URL = `https://hotwheels.fandom.com/wiki/${targetYear}_5-Packs`;
  console.log(`\n=== Processing Year ${targetYear} ===`);
  console.log(`Fetching ${targetYear} 5-Packs data from ${URL}…`);
  
  let html: string;
  try {
    html = await fetchWithRetry(URL);
  } catch (error) {
    console.error(`Failed to fetch ${URL} after retries:`, error);
    return;
  }
  
  const $ = cheerio.load(html);

  // Find the main table - try multiple selectors
  let table = $('table.wikitable').first();
  if (!table || table.length === 0) {
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
  // For 2009, we need at least Package#, Name, Vehicles (3 columns minimum)
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3; // At least Package#, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows. Processing…`);

  let totalUpdated = 0;
  let totalSkipped = 0;

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
    
    // Column 2: Vehicles (list of vehicles)
    const vehiclesCell = cells.length > 2 ? $(cells[2]) : null;
    const vehiclesText = vehiclesCell ? vehiclesCell.text().trim() : '';
    
    // Column 3: Notes (optional)
    const notesCell = cells.length > 3 ? $(cells[3]).text().trim() : '';

    // Validate required fields
    if (!packageNumber || !name) {
      console.warn(`Skipping row ${i + 1}: missing required data (Package#: ${packageNumber}, Name: ${name})`);
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
