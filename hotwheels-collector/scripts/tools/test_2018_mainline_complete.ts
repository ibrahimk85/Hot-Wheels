/**
 * Test script to compare 2018 Mainline Wiki data with database
 * Finds missing COL# numbers and verifies data completeness
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

interface WikiRow {
  toyNumber: string;
  collectorNumber: string | null;
  modelName: string;
  subSeries: string;
  tableType: 'main' | 'th' | 'sth' | 'additional';
  tableName: string;
}

async function main() {
  console.log('🔍 Testing 2018 Mainline data completeness...\n');

  // Find 2018 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2018,
      },
    },
  });

  if (!mainlineCollection) {
    throw new Error('2018 Mainline collection not found. Please import data first.');
  }

  // Get all COL# from database
  const dbVariants = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      cardNumber: {
        not: null,
      },
    },
    select: {
      cardNumber: true,
      toyNumber: true,
      model: {
        select: {
          castingName: true,
        },
      },
    },
  });

  const dbColNumbers = new Set(
    dbVariants
      .map(v => v.cardNumber)
      .filter((col): col is string => col !== null)
      .map(col => parseInt(col, 10))
      .filter(num => !isNaN(num))
  );

  console.log(`📊 Database:`);
  console.log(`   Total variants: ${dbVariants.length}`);
  console.log(`   Unique COL#: ${dbColNumbers.size}`);
  if (dbColNumbers.size > 0) {
    console.log(`   COL# range: ${Math.min(...Array.from(dbColNumbers))} - ${Math.max(...Array.from(dbColNumbers))}`);
  }

  // Fetch Wiki page
  console.log(`\n📥 Fetching Wiki page...`);
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Parse Wiki tables
  const wikiRows: WikiRow[] = [];
  
  // Main table
  const mainTable = $('table').first();
  const mainRows = mainTable.find('tbody tr');
  console.log(`\n📋 Main table: ${mainRows.length} rows`);

  mainRows.each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length === 0) return;

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = $(cells[1]).text().trim();
    const modelName = $(cells[2]).text().trim();
    const subSeries = $(cells[3]).text().trim();

    if (toyNumber && modelName) {
      wikiRows.push({
        toyNumber,
        collectorNumber: collectorNumberStr || null,
        modelName,
        subSeries,
        tableType: 'main',
        tableName: 'Main Table (1-365)',
      });
    }
  });

  // Find other tables
  const headings = $('h2, h3');
  let foundTH = false;
  let foundSTH = false;

  headings.each((index, heading) => {
    const headingText = $(heading).text().trim();
    
    if (/Hot Wheels Treasure Hunt/i.test(headingText) && !/Super Treasure Hunt/i.test(headingText)) {
      foundTH = true;
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const table = $(nextElement[0]);
        const rows = table.find('tbody tr');
        console.log(`📋 TH table: ${rows.length} rows`);
        
        rows.each((i, row) => {
          const cells = $(row).find('td');
          if (cells.length === 0) return;
          
          const toyNumber = $(cells[0]).text().trim();
          const modelName = $(cells[1] || cells[0]).text().trim();
          
          if (toyNumber && modelName) {
            wikiRows.push({
              toyNumber,
              collectorNumber: null,
              modelName,
              subSeries: 'Treasure Hunt',
              tableType: 'th',
              tableName: 'Treasure Hunt',
            });
          }
        });
      }
    }
    
    if (/Super Treasure Hunt/i.test(headingText)) {
      foundSTH = true;
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const table = $(nextElement[0]);
        const rows = table.find('tbody tr');
        console.log(`📋 STH table: ${rows.length} rows`);
        
        rows.each((i, row) => {
          const cells = $(row).find('td');
          if (cells.length === 0) return;
          
          const toyNumber = $(cells[0]).text().trim();
          const modelName = $(cells[1] || cells[0]).text().trim();
          
          if (toyNumber && modelName) {
            wikiRows.push({
              toyNumber,
              collectorNumber: null,
              modelName,
              subSeries: 'Super Treasure Hunt',
              tableType: 'sth',
              tableName: 'Super Treasure Hunt',
            });
          }
        });
      }
    }
    
    if (foundTH && foundSTH) {
      if (headingText && !/Super Treasure Hunt/i.test(headingText) && !/Hot Wheels Treasure Hunt/i.test(headingText)) {
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          const table = $(nextElement[0]);
          const rows = table.find('tbody tr');
          const tableName = headingText.replace(/\[.*?\]/g, '').trim();
          console.log(`📋 Additional table "${tableName}": ${rows.length} rows`);
          
          rows.each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length === 0) return;
            
            const toyNumber = $(cells[0]).text().trim();
            const modelName = $(cells[1] || cells[0]).text().trim();
            
            if (toyNumber && modelName) {
              wikiRows.push({
                toyNumber,
                collectorNumber: null,
                modelName,
                subSeries: tableName,
                tableType: 'additional',
                tableName: tableName,
              });
            }
          });
        }
      }
    }
  });

  console.log(`\n✅ Total Wiki rows found: ${wikiRows.length}`);

  // Analyze main table COL#
  const mainTableColNumbers = new Set<number>();
  const mainTableRowsWithCol = wikiRows.filter(r => r.tableType === 'main' && r.collectorNumber);
  
  mainTableRowsWithCol.forEach(row => {
    const colNum = parseInt(row.collectorNumber!, 10);
    if (!isNaN(colNum) && colNum >= 1 && colNum <= 365) {
      mainTableColNumbers.add(colNum);
    }
  });

  console.log(`\n📊 Main table analysis:`);
  console.log(`   Rows with COL#: ${mainTableRowsWithCol.length}`);
  console.log(`   Unique COL#: ${mainTableColNumbers.size}`);
  if (mainTableColNumbers.size > 0) {
    console.log(`   COL# range: ${Math.min(...Array.from(mainTableColNumbers))} - ${Math.max(...Array.from(mainTableColNumbers))}`);
  }

  // Find missing COL# in main table range (1-365)
  const expectedMainColNumbers = new Set<number>();
  for (let i = 1; i <= 365; i++) {
    expectedMainColNumbers.add(i);
  }

  const missingInWikiMainTable = Array.from(expectedMainColNumbers)
    .filter(col => !mainTableColNumbers.has(col))
    .sort((a, b) => a - b);

  const missingInDatabase = Array.from(mainTableColNumbers)
    .filter(col => !dbColNumbers.has(col))
    .sort((a, b) => a - b);

  console.log(`\n❌ Missing COL# in Wiki main table (should be 1-365): ${missingInWikiMainTable.length}`);
  if (missingInWikiMainTable.length > 0 && missingInWikiMainTable.length <= 50) {
    console.log(`   Missing: ${missingInWikiMainTable.join(', ')}`);
  } else if (missingInWikiMainTable.length > 50) {
    console.log(`   Missing (first 50): ${missingInWikiMainTable.slice(0, 50).join(', ')}...`);
  }

  console.log(`\n❌ Missing COL# in Database (from Wiki main table): ${missingInDatabase.length}`);
  if (missingInDatabase.length > 0) {
    console.log(`   Missing: ${missingInDatabase.join(', ')}`);
    
    // Show details for missing COL#
    console.log(`\n📝 Details for missing COL# (first 20):`);
    for (const missingCol of missingInDatabase.slice(0, 20)) {
      const wikiRow = wikiRows.find(r => 
        r.tableType === 'main' && 
        r.collectorNumber && 
        parseInt(r.collectorNumber, 10) === missingCol
      );
      if (wikiRow) {
        console.log(`   COL# ${missingCol}: ${wikiRow.modelName} (Toy#: ${wikiRow.toyNumber}, Series: ${wikiRow.subSeries})`);
      }
    }
    if (missingInDatabase.length > 20) {
      console.log(`   ... and ${missingInDatabase.length - 20} more`);
    }
  }

  // Check COL# 258 specifically
  console.log(`\n🔍 Checking COL# 258 specifically:`);
  const col258InWiki = wikiRows.find(r => r.collectorNumber === '258');
  const col258InDb = dbVariants.find(v => v.cardNumber === '258');
  
  if (col258InWiki) {
    console.log(`   ✅ Found in Wiki: ${col258InWiki.modelName} (Toy#: ${col258InWiki.toyNumber}, Table: ${col258InWiki.tableName})`);
  } else {
    console.log(`   ❌ NOT found in Wiki`);
  }
  
  if (col258InDb) {
    console.log(`   ✅ Found in Database: ${col258InDb.model.castingName} (Toy#: ${col258InDb.toyNumber})`);
  } else {
    console.log(`   ❌ NOT found in Database`);
  }

  // Check Toy# matching
  const wikiToyNumbers = new Set(wikiRows.map(r => r.toyNumber).filter(t => t && t.length > 0));
  const dbToyNumbers = new Set(dbVariants.map(v => v.toyNumber).filter((t): t is string => t !== null && t.length > 0));
  
  const missingToyNumbers = Array.from(wikiToyNumbers).filter(t => !dbToyNumbers.has(t));
  
  console.log(`\n📊 Toy# analysis:`);
  console.log(`   Wiki Toy#: ${wikiToyNumbers.size}`);
  console.log(`   Database Toy#: ${dbToyNumbers.size}`);
  console.log(`   Missing Toy# in database: ${missingToyNumbers.length}`);
  if (missingToyNumbers.length > 0 && missingToyNumbers.length <= 20) {
    console.log(`   Missing: ${missingToyNumbers.join(', ')}`);
  } else if (missingToyNumbers.length > 20) {
    console.log(`   Missing (first 20): ${missingToyNumbers.slice(0, 20).join(', ')}...`);
  }

  // Summary
  console.log(`\n📈 Summary:`);
  console.log(`   Wiki main table rows: ${wikiRows.filter(r => r.tableType === 'main').length}`);
  console.log(`   Wiki main table unique COL#: ${mainTableColNumbers.size}`);
  console.log(`   Database unique COL#: ${dbColNumbers.size}`);
  console.log(`   Missing in database: ${missingInDatabase.length}`);
  console.log(`   Expected range 1-365: ${expectedMainColNumbers.size} numbers`);
  if (expectedMainColNumbers.size > 0) {
    console.log(`   Coverage: ${((mainTableColNumbers.size / expectedMainColNumbers.size) * 100).toFixed(1)}%`);
  }
  
  if (missingInDatabase.length === 0 && missingToyNumbers.length === 0) {
    console.log(`\n✅ All data imported successfully!`);
  } else {
    console.log(`\n⚠️  Some data is missing. Please check the details above.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






