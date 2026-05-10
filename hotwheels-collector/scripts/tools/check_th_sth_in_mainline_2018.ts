import 'dotenv/config';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

async function main() {
  console.log('Fetching 2018 Hot Wheels wiki page...');
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Find mainline table
  const mainlineTable = $('table.wikitable').first();
  const mainlineRows = mainlineTable.find('tbody tr');
  
  console.log(`Found ${mainlineRows.length} rows in mainline table`);
  
  // Extract all Toy# from mainline table
  const mainlineToyNumbers = new Set<string>();
  mainlineRows.each((index: number, row: any) => {
    const cells = $(row).find('td');
    if (cells.length === 0) return; // Skip header rows
    
    const toyNumber = $(cells[0]).text().trim();
    if (toyNumber && toyNumber.length > 0) {
      mainlineToyNumbers.add(toyNumber);
    }
  });
  
  console.log(`\nFound ${mainlineToyNumbers.size} unique Toy# in mainline table`);
  
  // Find TH and STH tables
  const headings = $('h2, h3');
  let thTable: any = null;
  let sthTable: any = null;
  
  headings.each((index, heading) => {
    const headingText = $(heading).text().trim();
    
    if (/Hot Wheels Treasure Hunts/i.test(headingText) && !/Super/i.test(headingText)) {
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        thTable = $(nextElement[0]);
      }
    }
    
    if (/Super Treasure Hunt/i.test(headingText)) {
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        sthTable = $(nextElement[0]);
      }
    }
  });

  // Extract TH Toy#
  const thToyNumbers: string[] = [];
  if (thTable && thTable.length > 0) {
    const thRows = thTable.find('tbody tr');
    thRows.each((index: number, row: any) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;
      const toyNumber = $(cells[0]).text().trim();
      if (toyNumber && toyNumber.length > 0) {
        thToyNumbers.push(toyNumber);
      }
    });
  }

  // Extract STH Toy#
  const sthToyNumbers: string[] = [];
  if (sthTable && sthTable.length > 0) {
    const sthRows = sthTable.find('tbody tr');
    sthRows.each((index: number, row: any) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;
      const toyNumber = $(cells[0]).text().trim();
      if (toyNumber && toyNumber.length > 0) {
        sthToyNumbers.push(toyNumber);
      }
    });
  }

  console.log(`\nTH Toy# count: ${thToyNumbers.length}`);
  console.log(`STH Toy# count: ${sthToyNumbers.length}`);

  // Check which TH Toy# are in mainline table
  console.log('\nChecking TH Toy# in mainline table:');
  const thInMainline: string[] = [];
  const thNotInMainline: string[] = [];
  thToyNumbers.forEach(toyNumber => {
    if (mainlineToyNumbers.has(toyNumber)) {
      thInMainline.push(toyNumber);
    } else {
      thNotInMainline.push(toyNumber);
    }
  });
  
  console.log(`  In mainline: ${thInMainline.length}`);
  thInMainline.forEach(t => console.log(`    ✓ ${t}`));
  console.log(`  NOT in mainline: ${thNotInMainline.length}`);
  thNotInMainline.forEach(t => console.log(`    ✗ ${t}`));

  // Check which STH Toy# are in mainline table
  console.log('\nChecking STH Toy# in mainline table:');
  const sthInMainline: string[] = [];
  const sthNotInMainline: string[] = [];
  sthToyNumbers.forEach(toyNumber => {
    if (mainlineToyNumbers.has(toyNumber)) {
      sthInMainline.push(toyNumber);
    } else {
      sthNotInMainline.push(toyNumber);
    }
  });
  
  console.log(`  In mainline: ${sthInMainline.length}`);
  sthInMainline.forEach(t => console.log(`    ✓ ${t}`));
  console.log(`  NOT in mainline: ${sthNotInMainline.length}`);
  sthNotInMainline.forEach(t => console.log(`    ✗ ${t}`));
}

main().catch(console.error);















