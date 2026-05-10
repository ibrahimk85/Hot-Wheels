/**
 * Complete script to download and sync images for ALL 2018 Mainline tables
 * 
 * This script processes:
 * 1. Main table (COL# 1-365)
 * 2. Treasure Hunt table
 * 3. Super Treasure Hunt table
 * 4. All additional tables
 * 
 * Images are matched by Toy# to variants in the database.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  await downloadFandomBinary(url, dest);
}

interface TableInfo {
  heading: string;
  table: any;
  tableType: 'main' | 'th' | 'sth' | 'additional';
}

async function main() {
  console.log('🚀 Starting complete 2018 Mainline image download and sync...\n');

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

  // Fetch Wiki page
  console.log('📥 Fetching Wiki page...');
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Find all tables
  const tablesToProcess: TableInfo[] = [];
  
  // Main table
  const mainTable = $('table').first();
  if (mainTable.length > 0) {
    tablesToProcess.push({
      heading: 'Main Table',
      table: mainTable,
      tableType: 'main',
    });
  }

  // Find TH, STH, and additional tables
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
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          tableType: 'th',
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
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          tableType: 'sth',
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
          tablesToProcess.push({
            heading: headingText,
            table: $(nextElement[0]),
            tableType: 'additional',
          });
        }
      }
    }
  });

  console.log(`📊 Found ${tablesToProcess.length} tables to process\n`);

  let totalDownloaded = 0;
  let totalAssociated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each table
  for (const tableInfo of tablesToProcess) {
    const { table, tableType } = tableInfo;
    console.log(`\n📋 Processing ${tableType} table: ${tableInfo.heading}`);

    const rows = table.find('tbody tr');
    console.log(`   Found ${rows.length} rows`);

    // Get headers
    const headerRow = table.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();
    
    // Determine column indices
    let toyNumberIndex = 0;
    let modelNameIndex = 2;
    let imageIndex = 5;

    headers.forEach((header: string, index: number) => {
      if (/Toy#|Toy #/i.test(header)) toyNumberIndex = index;
      if (/Model|Name|Cast/i.test(header) && index > toyNumberIndex) modelNameIndex = index;
      if (/Image|Photo|Pic/i.test(header)) imageIndex = index;
    });

    let tableDownloaded = 0;
    let tableAssociated = 0;
    let tableSkipped = 0;
    let tableErrors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      const toyNumber = $(cells[toyNumberIndex] || cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) {
        tableSkipped++;
        continue;
      }

      const modelNameRaw = $(cells[modelNameIndex] || cells[2] || cells[1] || cells[0]).text().trim();
      if (!modelNameRaw) {
        tableSkipped++;
        continue;
      }

      // Get image
      const imgElement = $(cells[imageIndex] || cells[5] || cells[cells.length - 1]).find('img');
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
      
      if (!imgUrl) {
        tableSkipped++;
        continue;
      }

      // Ensure URL is absolute
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }

      // Get full-size image URL
      let fullImgUrl = imgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

      // Parse model name
      let castingName = modelNameRaw;
      const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
      }

      // Find variant by Toy#
      const variant = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber.trim(),
          year: 2018,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
        include: {
          model: true,
        },
      });

      if (!variant) {
        console.warn(`   ⚠️  Variant not found for Toy# ${toyNumber} (${castingName})`);
        tableSkipped++;
        continue;
      }

      // Check if variant already has image
      if (variant.imageId !== null && variant.imageId !== undefined) {
        tableSkipped++;
        continue;
      }

      // Download image
      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${toyNumber}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      let downloaded = false;
      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          downloaded = true;
          tableDownloaded++;
          totalDownloaded++;
        } catch (err) {
          console.error(`   ❌ Error downloading ${fullImgUrl}:`, err);
          tableErrors++;
          totalErrors++;
          continue;
        }
      }

      // Create Image record and associate
      try {
        const relativePath = path.join('/images', 'hotwheels', '2018', 'mainline', castingSlug, fileName).replace(/\\/g, '/');
        
        const imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: castingName,
            variant: { connect: { id: variant.id } },
          },
        });

        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: imageRecord.id },
        });

        tableAssociated++;
        totalAssociated++;
        
        if (downloaded) {
          console.log(`   ✅ Downloaded & associated: ${castingName} (Toy#: ${toyNumber})`);
        } else {
          console.log(`   ✅ Associated existing image: ${castingName} (Toy#: ${toyNumber})`);
        }
      } catch (err) {
        console.error(`   ❌ Error creating image record for ${castingName}:`, err);
        tableErrors++;
        totalErrors++;
      }
    }

    console.log(`   📊 Table stats: ${tableDownloaded} downloaded, ${tableAssociated} associated, ${tableSkipped} skipped, ${tableErrors} errors`);
  }

  console.log(`\n🎉 Complete!`);
  console.log(`   Total downloaded: ${totalDownloaded}`);
  console.log(`   Total associated: ${totalAssociated}`);
  console.log(`   Total skipped: ${totalSkipped}`);
  console.log(`   Total errors: ${totalErrors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






