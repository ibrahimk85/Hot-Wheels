/**
 * Script to update Treasure Hunt (TH) and Super Treasure Hunt (STH) flags
 * for 2018 Mainline variants by reading the TH and STH tables from the wiki.
 * 
 * This script:
 * 1. Fetches the 2018 Hot Wheels wiki page
 * 2. Finds the "Hot Wheels Treasure Hunt" and "Super Treasure Hunt" tables at the end
 * 3. Extracts Toy# values from these tables
 * 4. Updates the corresponding variants in the database by matching Toy#
 * 
 * IMPORTANT: This uses Toy# for matching, which is the most reliable method.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

async function main() {
  console.log('Fetching 2018 Hot Wheels wiki page...');
  const response = await fetch(WIKI_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${WIKI_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

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
    console.log('2018 Mainline collection not found. Please import data first.');
    return;
  }

  // Find all tables on the page
  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  // Look for TH and STH tables - they are usually at the end of the page
  // Search for tables that contain "Treasure Hunt" in their headers or nearby text
  let thTable: any = null;
  let sthTable: any = null;

  // Find tables by looking for headers containing "Treasure Hunt" or "Super Treasure Hunt"
  allTables.each((index, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    // Check if this is the TH table
    if (/Hot Wheels Treasure Hunt/i.test(tableText) && !/Super Treasure Hunt/i.test(tableText)) {
      // Make sure it's not the STH table
      const headers = $table.find('th').text();
      if (/Treasure Hunt/i.test(headers) && !/Super/i.test(headers)) {
        thTable = $table;
        console.log(`Found TH table at index ${index}`);
      }
    }
    
    // Check if this is the STH table
    if (/Super Treasure Hunt/i.test(tableText)) {
      const headers = $table.find('th').text();
      if (/Super Treasure Hunt/i.test(headers)) {
        sthTable = $table;
        console.log(`Found STH table at index ${index}`);
      }
    }
  });

  // Alternative: Look for tables after specific headings
  if (!thTable || !sthTable) {
    // Find headings first
    const headings = $('h2, h3');
    headings.each((index, heading) => {
      const headingText = $(heading).text().trim();
      
      if (/Hot Wheels Treasure Hunt/i.test(headingText) && !/Super/i.test(headingText)) {
        // Find the next table after this heading
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          thTable = $(nextElement[0]);
          console.log(`Found TH table after heading: ${headingText}`);
        }
      }
      
      if (/Super Treasure Hunt/i.test(headingText)) {
        // Find the next table after this heading
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          sthTable = $(nextElement[0]);
          console.log(`Found STH table after heading: ${headingText}`);
        }
      }
    });
  }

  if (!thTable) {
    console.warn('⚠️  TH table not found. Trying alternative search...');
    // Try to find by looking for tables with Toy# column
    allTables.each((index, table) => {
      const $table = $(table);
      const firstRow = $table.find('tr').first();
      const headers = firstRow.find('th, td').map((i, el) => $(el).text().trim()).get();
      
      // Check if this table has Toy# column and is likely TH table
      if (headers.some(h => /Toy#|Toy #/i.test(h))) {
        const tableText = $table.text();
        // Check if it mentions Treasure Hunt but not Super
        if (/Treasure Hunt/i.test(tableText) && !/Super Treasure Hunt/i.test(tableText)) {
          // Count how many rows - TH tables usually have fewer rows than main table
          const rowCount = $table.find('tbody tr').length;
          if (rowCount > 0 && rowCount < 50) { // TH tables are usually smaller
            thTable = $table;
            console.log(`Found potential TH table at index ${index} with ${rowCount} rows`);
          }
        }
      }
    });
  }

  if (!sthTable) {
    console.warn('⚠️  STH table not found. Trying alternative search...');
    // Try to find by looking for tables with Toy# column
    allTables.each((index, table) => {
      const $table = $(table);
      const firstRow = $table.find('tr').first();
      const headers = firstRow.find('th, td').map((i, el) => $(el).text().trim()).get();
      
      // Check if this table has Toy# column and is likely STH table
      if (headers.some(h => /Toy#|Toy #/i.test(h))) {
        const tableText = $table.text();
        // Check if it mentions Super Treasure Hunt
        if (/Super Treasure Hunt/i.test(tableText)) {
          // Count how many rows - STH tables usually have very few rows
          const rowCount = $table.find('tbody tr').length;
          if (rowCount > 0 && rowCount < 20) { // STH tables are usually very small
            sthTable = $table;
            console.log(`Found potential STH table at index ${index} with ${rowCount} rows`);
          }
        }
      }
    });
  }

  // Extract Toy# and model info from TH table
  interface THSTHEntry {
    toyNumber: string;
    modelName?: string;
    cardNumber?: string;
  }
  
  const thEntries: THSTHEntry[] = [];
  if (thTable && thTable.length > 0) {
    console.log('\n📋 Processing TH table...');
    const thRows = thTable.find('tbody tr');
    console.log(`Found ${thRows.length} rows in TH table`);
    
    // Get headers to understand column structure
    const headerRow = thTable.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();
    console.log(`TH table headers: ${headers.join(', ')}`);
    
    thRows.each((index: number, row: any) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return; // Skip header rows
      
      const entry: THSTHEntry = {
        toyNumber: $(cells[0]).text().trim(),
      };
      
      // Try to extract model name and card number if available
      if (cells.length > 1) {
        entry.modelName = $(cells[1]).text().trim();
      }
      if (cells.length > 2) {
        entry.cardNumber = $(cells[2]).text().trim();
      }
      
      if (entry.toyNumber && entry.toyNumber.length > 0) {
        thEntries.push(entry);
        console.log(`  TH: ${entry.toyNumber} - ${entry.modelName || 'N/A'}`);
      }
    });
    
    console.log(`\n✅ Found ${thEntries.length} TH entries`);
  } else {
    console.warn('⚠️  TH table not found!');
  }

  // Extract Toy# and model info from STH table
  const sthEntries: THSTHEntry[] = [];
  if (sthTable && sthTable.length > 0) {
    console.log('\n📋 Processing STH table...');
    const sthRows = sthTable.find('tbody tr');
    console.log(`Found ${sthRows.length} rows in STH table`);
    
    // Get headers to understand column structure
    const headerRow = sthTable.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();
    console.log(`STH table headers: ${headers.join(', ')}`);
    
    sthRows.each((index: number, row: any) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return; // Skip header rows
      
      const entry: THSTHEntry = {
        toyNumber: $(cells[0]).text().trim(),
      };
      
      // Try to extract model name and card number if available
      if (cells.length > 1) {
        entry.modelName = $(cells[1]).text().trim();
      }
      if (cells.length > 2) {
        entry.cardNumber = $(cells[2]).text().trim();
      }
      
      if (entry.toyNumber && entry.toyNumber.length > 0) {
        sthEntries.push(entry);
        console.log(`  STH: ${entry.toyNumber} - ${entry.modelName || 'N/A'}`);
      }
    });
    
    console.log(`\n✅ Found ${sthEntries.length} STH entries`);
  } else {
    console.warn('⚠️  STH table not found!');
  }
  
  // Extract Toy# arrays for backward compatibility
  const thToyNumbers = thEntries.map(e => e.toyNumber);
  const sthToyNumbers = sthEntries.map(e => e.toyNumber);

  // Update variants in database
  console.log('\n🔄 Updating variants in database...');
  
  let thUpdated = 0;
  let sthUpdated = 0;

  // Update TH variants
  // NOTE: TH/STH Toy# may not be in mainline table, but we can still update them
  // by matching Toy# from the image filenames or from the TH/STH tables
  if (thToyNumbers.length > 0) {
    for (const toyNumber of thToyNumbers) {
      // Try to find variant by Toy# - it might exist even if not in mainline table
      const existing = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber,
          year: 2018,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
      });
      
      if (!existing) {
        // Try to find by Toy# without collection constraint (in case it's in a different collection)
        const existingAnywhere = await prisma.variant.findFirst({
          where: {
            toyNumber: toyNumber,
            year: 2018,
          },
        });
        
        if (!existingAnywhere) {
          console.warn(`  ⚠️  Variant not found for TH Toy#: ${toyNumber} (may not be in mainline table)`);
          continue;
        } else {
          // Found in different collection, update it anyway
          const updated = await prisma.variant.updateMany({
            where: {
              toyNumber: toyNumber,
              year: 2018,
              isSuperTreasureHunt: false,
            },
            data: {
              isTreasureHunt: true,
            },
          });
          if (updated.count > 0) {
            thUpdated += updated.count;
            console.log(`  ✓ Updated ${updated.count} variant(s) for TH Toy#: ${toyNumber} (found in different collection)`);
          }
          continue;
        }
      }
      
      const updated = await prisma.variant.updateMany({
        where: {
          toyNumber: toyNumber,
          year: 2018,
          model: {
            collectionId: mainlineCollection.id,
          },
          // Only update if not already STH (STH takes precedence)
          isSuperTreasureHunt: false,
        },
        data: {
          isTreasureHunt: true,
        },
      });
      if (updated.count > 0) {
        thUpdated += updated.count;
        console.log(`  ✓ Updated ${updated.count} variant(s) for TH Toy#: ${toyNumber}`);
      } else {
        console.log(`  ℹ️  Variant already updated or is STH for TH Toy#: ${toyNumber}`);
      }
    }
  }

  // Update STH variants (STH takes precedence over TH)
  // NOTE: TH/STH Toy# may not be in mainline table, but we can still update them
  if (sthToyNumbers.length > 0) {
    for (const toyNumber of sthToyNumbers) {
      // Try to find variant by Toy# - it might exist even if not in mainline table
      const existing = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber,
          year: 2018,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
      });
      
      if (!existing) {
        // Try to find by Toy# without collection constraint (in case it's in a different collection)
        const existingAnywhere = await prisma.variant.findFirst({
          where: {
            toyNumber: toyNumber,
            year: 2018,
          },
        });
        
        if (!existingAnywhere) {
          console.warn(`  ⚠️  Variant not found for STH Toy#: ${toyNumber} (may not be in mainline table)`);
          continue;
        } else {
          // Found in different collection, update it anyway
          const updated = await prisma.variant.updateMany({
            where: {
              toyNumber: toyNumber,
              year: 2018,
            },
            data: {
              isSuperTreasureHunt: true,
              isTreasureHunt: false,
            },
          });
          if (updated.count > 0) {
            sthUpdated += updated.count;
            console.log(`  ✓ Updated ${updated.count} variant(s) for STH Toy#: ${toyNumber} (found in different collection)`);
          }
          continue;
        }
      }
      
      const updated = await prisma.variant.updateMany({
        where: {
          toyNumber: toyNumber,
          year: 2018,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
        data: {
          isSuperTreasureHunt: true,
          isTreasureHunt: false, // STH is not TH
        },
      });
      if (updated.count > 0) {
        sthUpdated += updated.count;
        console.log(`  ✓ Updated ${updated.count} variant(s) for STH Toy#: ${toyNumber}`);
      } else {
        console.log(`  ℹ️  Variant already updated for STH Toy#: ${toyNumber}`);
      }
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`  TH variants updated: ${thUpdated}`);
  console.log(`  STH variants updated: ${sthUpdated}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

