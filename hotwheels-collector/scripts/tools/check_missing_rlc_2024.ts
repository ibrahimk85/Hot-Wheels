/**
 * Script to check for missing 2024 RLC models by comparing database with wiki
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_missing_rlc_2024.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();
const RLC_URL = 'https://hotwheels.fandom.com/wiki/2024_HWC/RLC_Releases';
const TARGET_YEAR = 2024;
const COLLECTION_NAME = 'Red Line Club';

function findColumnIndex(headers: cheerio.Cheerio<any>, searchTerms: string[]): number {
  let index = -1;
  headers.each((idx, cell) => {
    const text = cheerio.load(cell).text().trim().toLowerCase();
    if (searchTerms.some(term => text.includes(term))) {
      index = idx;
      return false;
    }
  });
  return index;
}

function normalizeCastingName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['"]/g, '')
    .replace(/[^\w\s]/g, '');
}

async function getWikiModels(): Promise<Map<string, string>> {
  console.log(`Fetching ${COLLECTION_NAME} ${TARGET_YEAR} data from wiki...`);
  const response = await fetch(RLC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RLC_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const table = $('table.wikitable, table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the RLC table on the page');
  }

  const headerRow = table.find('thead tr, tbody tr').first();
  const headerCells = headerRow.find('th, td');
  
  const castingColIdx = findColumnIndex(headerCells, ['casting', 'casting name', 'model', 'car']);

  if (castingColIdx === -1) {
    throw new Error('Could not find Casting Name column in table');
  }

  const tbodyRows = table.find('tbody tr');
  const wikiModels = new Map<string, string>(); // normalized -> original

  for (let i = 0; i < tbodyRows.length; i++) {
    const row = tbodyRows[i];
    const cells = $(row).find('td, th');
    
    if (cells.length < 2) continue;
    
    const castingNameCell = castingColIdx >= 0 && cells.length > castingColIdx 
      ? $(cells[castingColIdx]) 
      : null;
    
    if (!castingNameCell || castingNameCell.length === 0) continue;
    
    const castingNameLink = castingNameCell.find('a').first();
    const castingName = castingNameLink.length > 0 
      ? castingNameLink.text().trim() 
      : castingNameCell.text().trim();
    
    if (!castingName || castingName.length === 0) continue;

    const normalized = normalizeCastingName(castingName);
    wikiModels.set(normalized, castingName);
  }

  return wikiModels;
}

async function getDatabaseModels(): Promise<Map<string, string>> {
  console.log(`\nFetching ${COLLECTION_NAME} ${TARGET_YEAR} models from database...`);
  
  const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRecord) {
    console.log(`  No year record found for ${TARGET_YEAR}`);
    return new Map();
  }

  const collectionRecord = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });

  if (!collectionRecord) {
    console.log(`  No collection record found for ${COLLECTION_NAME} ${TARGET_YEAR}`);
    return new Map();
  }

  const models = await prisma.model.findMany({
    where: {
      collectionId: collectionRecord.id,
    },
    select: {
      castingName: true,
    },
  });

  const dbModels = new Map<string, string>(); // normalized -> original
  models.forEach(model => {
    const normalized = normalizeCastingName(model.castingName);
    dbModels.set(normalized, model.castingName);
  });

  return dbModels;
}

async function main() {
  try {
    const wikiModels = await getWikiModels();
    const dbModels = await getDatabaseModels();

    console.log(`\n=== Comparison Results ===`);
    console.log(`Wiki models: ${wikiModels.size}`);
    console.log(`Database models: ${dbModels.size}`);

    // Find models in wiki but not in database
    const missingInDb: Array<{ normalized: string; original: string }> = [];
    wikiModels.forEach((original, normalized) => {
      if (!dbModels.has(normalized)) {
        missingInDb.push({ normalized, original });
      }
    });

    // Find models in database but not in wiki (might be extra)
    const extraInDb: Array<{ normalized: string; original: string }> = [];
    dbModels.forEach((original, normalized) => {
      if (!wikiModels.has(normalized)) {
        extraInDb.push({ normalized, original });
      }
    });

    console.log(`\n=== Missing in Database (${missingInDb.length}) ===`);
    if (missingInDb.length > 0) {
      missingInDb.forEach(({ original }) => {
        console.log(`  - ${original}`);
      });
      console.log(`\nTo add these models, run:`);
      console.log(`  npx ts-node scripts/import/import_rlc_2024.ts`);
    } else {
      console.log(`  None! All wiki models are in database.`);
    }

    console.log(`\n=== Extra in Database (${extraInDb.length}) ===`);
    if (extraInDb.length > 0) {
      extraInDb.forEach(({ original }) => {
        console.log(`  - ${original}`);
      });
      console.log(`\nThese models are in database but not in wiki.`);
    } else {
      console.log(`  None! Database matches wiki exactly.`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();







