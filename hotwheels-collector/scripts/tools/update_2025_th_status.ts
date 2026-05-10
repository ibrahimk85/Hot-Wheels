/**
 * Script to update 2025 Treasure Hunt and Super Treasure Hunt status
 * by scraping the Hot Wheels Fandom wiki page and matching entries
 * with database variants.
 *
 * This script:
 * 1. Fetches the List of 2025 Hot Wheels page from hotwheels.fandom.com
 * 2. Parses the main table and finds rows where Series column contains "Treasure Hunt" or "Super Treasure Hunt"
 * 3. Matches entries with database variants using Toy # (castingId) and Collector # (cardNumber)
 * 4. Updates isTreasureHunt and isSuperTreasureHunt flags accordingly
 *
 * Usage:
 *   npx ts-node scripts/tools/update_2025_th_status.ts
 */

import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const url = 'https://hotwheels.fandom.com/wiki/List_of_2025_Hot_Wheels';

interface Entry {
  toyNumber: string;
  collectorNumber: string;
  isSuper: boolean;
}

async function parseTreasureHunts(): Promise<Entry[]> {
  console.log('Fetching page from Fandom wiki...');
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  const entries: Entry[] = [];

  // Find the main table with columns: Toy #, Col.#, Model Name, Series, Series #
  // Look for table with header row containing "Toy #" and "Col.#"
  const tables = $('table');
  
  let mainTable: any = null;
  
  tables.each((_, table) => {
    const headerRow = $(table).find('tr').first();
    const headerText = headerRow.text();
    
    // Check if this table has the columns we need
    if (headerText.includes('Toy #') && headerText.includes('Col.#') && headerText.includes('Series')) {
      mainTable = $(table);
      return false; // break
    }
  });

  if (!mainTable) {
    throw new Error('Could not find the main table with Toy #, Col.#, and Series columns');
  }

  console.log('Parsing main table for TH/STH entries...');

  // Parse table rows (skip header row)
  (mainTable as ReturnType<typeof $>).find('tr').slice(1).each((_: any, row: any) => {
    const cells = $(row).find('td');
    
    if (cells.length < 4) return; // Skip rows without enough columns

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumber = $(cells[1]).text().trim();
    const seriesText = $(cells[3]).text().trim(); // Series column (4th column, index 3)

    // Check if Series column contains "Treasure Hunt" or "Super Treasure Hunt"
    const isTreasureHunt = /Treasure Hunt/i.test(seriesText) && !/Super Treasure Hunt/i.test(seriesText);
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(seriesText);

    if ((isTreasureHunt || isSuperTreasureHunt) && toyNumber && collectorNumber) {
      entries.push({
        toyNumber,
        collectorNumber,
        isSuper: isSuperTreasureHunt,
      });
    }
  });

  return entries;
}

async function updateVariants() {
  console.log('=== 2025 Treasure Hunt Status Update ===\n');

  // First, check if we have any 2025 variants in the database
  const variantCount = await prisma.variant.count({
    where: { year: 2025 },
  });
  console.log(`Found ${variantCount} variants in database for year 2025\n`);

  if (variantCount === 0) {
    console.warn('⚠ No 2025 variants found in database. Please import 2025 mainline data first.');
    return;
  }

  // Show sample variants to understand the format
  const sampleVariants = await prisma.variant.findMany({
    where: { year: 2025 },
    take: 5,
    include: {
      model: {
        select: {
          castingId: true,
          castingName: true,
        },
      },
    },
  });

  if (sampleVariants.length > 0) {
    console.log('Sample variants in database:');
    sampleVariants.forEach(v => {
      console.log(`  - Card #: "${v.cardNumber}", Casting ID: "${v.model.castingId}", Model: ${v.model.castingName}`);
    });
    console.log('');
  }

  const entries = await parseTreasureHunts();
  console.log(`\nFound ${entries.length} TH/STH entries total.`);
  console.log(`  - Treasure Hunts: ${entries.filter(e => !e.isSuper).length}`);
  console.log(`  - Super Treasure Hunts: ${entries.filter(e => e.isSuper).length}\n`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const entry of entries) {
    const { toyNumber, collectorNumber, isSuper } = entry;

    // Extract base card number from formats like "017/250" -> "017"
    const cardNumberParts = collectorNumber.split('/');
    const cardNumberBase = cardNumberParts[0]?.trim();
    const cardNumberNoLeadingZeros = cardNumberBase ? cardNumberBase.replace(/^0+/, '') || cardNumberBase : null;

    // Try multiple matching strategies
    // Strategy 1: Exact match with castingId and full collectorNumber (e.g., "017/250")
    let variants = await prisma.variant.findMany({
      where: {
        year: 2025,
        cardNumber: collectorNumber,
        model: {
          castingId: toyNumber,
        },
      },
    });

    // Strategy 2: Match with base card number (e.g., "017" from "017/250")
    if (variants.length === 0 && cardNumberBase) {
      variants = await prisma.variant.findMany({
        where: {
          year: 2025,
          cardNumber: cardNumberBase,
          model: {
            castingId: toyNumber,
          },
        },
      });
    }

    // Strategy 3: Match with cardNumber without leading zeros (e.g., "17" from "017")
    if (variants.length === 0 && cardNumberNoLeadingZeros && cardNumberNoLeadingZeros !== cardNumberBase) {
      variants = await prisma.variant.findMany({
        where: {
          year: 2025,
          cardNumber: cardNumberNoLeadingZeros,
          model: {
            castingId: toyNumber,
          },
        },
      });
    }

    if (variants.length === 0) {
      // Debug: Check if cardNumber exists in database
      const cardNumberExists = await prisma.variant.findFirst({
        where: {
          year: 2025,
          OR: [
            { cardNumber: collectorNumber },
            { cardNumber: cardNumberBase },
            ...(cardNumberNoLeadingZeros && cardNumberNoLeadingZeros !== cardNumberBase 
              ? [{ cardNumber: cardNumberNoLeadingZeros }] 
              : []),
          ],
        },
      });

      // Debug: Check if castingId exists in database
      const castingIdExists = await prisma.model.findFirst({
        where: {
          castingId: toyNumber,
          collection: {
            year: {
              year: 2025,
            },
          },
        },
      });

      const debugInfo = [];
      if (!cardNumberExists) {
        debugInfo.push('cardNumber not found');
      }
      if (!castingIdExists) {
        debugInfo.push('castingId not found');
      }

      console.warn(
        `⚠ No match found: Toy # ${toyNumber}, Col. # ${collectorNumber} (${isSuper ? 'STH' : 'TH'})${debugInfo.length > 0 ? ` [${debugInfo.join(', ')}]` : ''}`
      );
      notFoundCount++;
      continue;
    }

    // Update variant(s) - only the exact matches (both Toy # and Col # must match)
    for (const v of variants) {
      await prisma.variant.update({
        where: { id: v.id },
        data: {
          isTreasureHunt: !isSuper,
          isSuperTreasureHunt: isSuper,
        },
      });
      updatedCount++;
      console.log(
        `✓ Updated variant ID ${v.id}: ${isSuper ? 'Super Treasure Hunt' : 'Treasure Hunt'} (Toy # ${toyNumber}, Col. # ${collectorNumber})`
      );
    }
  }

  console.log('\n=== Update Summary ===');
  console.log(`Total entries processed: ${entries.length}`);
  console.log(`Variants updated: ${updatedCount}`);
  console.log(`Entries not found: ${notFoundCount}`);
  console.log('\n✅ Update completed!');
}

updateVariants()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










