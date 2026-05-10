/**
 * Script to download image assets for the 2013 Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script processes ALL tables from the 2013 wiki page, where each table
 * represents a different sub-series. It extracts image URLs and matches them
 * to variants using Toy#.
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2013 mainline variants using the import script provided earlier.
 *   - CRITICAL: 2013'de 2nd/3rd color varyantları aynı COL# ama farklı Toy#.
 *     Bu nedenle eşleştirme öncelikle Toy# ile yapılır.
 *   - Running this script multiple times is safe; it will only download
 *     missing images and create missing associations.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2013_Hot_Wheels';

/**
 * Convert a casting name into a safe folder slug.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  await downloadFandomBinary(url, dest);
}

async function main() {
  console.log('Fetching 2013 mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);

  // Find 2013 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2013,
      },
    },
  });
  
  if (!mainlineCollection) {
    throw new Error('2013 Mainline collection not found. Please import data first.');
  }

  // Find ALL tables on the page
  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  // Base folder for image storage
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2013', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownloadCount = 0;
  let totalAssociatedCount = 0;

  // Process each table (use for loop to allow await)
  const tablesArray: any[] = [];
  allTables.each((index, tableElement) => {
    tablesArray.push($(tableElement));
  });

  for (let tableIndex = 0; tableIndex < tablesArray.length; tableIndex++) {
    const table = tablesArray[tableIndex];
    const rows = table.find('tbody tr, tr');
    
    if (rows.length < 2) {
      continue; // Skip tables with too few rows
    }
    
    console.log(`\nProcessing table ${tableIndex + 1} (${rows.length} rows)...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      // Extract data from row
      const toyNumber = $(cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue;
      
      const collectorNumberStr = $(cells[1]).text().trim();
      const modelNameRaw = $(cells[2]).text().trim();
      const subSeriesName = $(cells[3]).text().trim();
      
      // Image element is in the last cell (usually index 5)
      const imgElement = $(cells[cells.length - 1]).find('img').first();
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
      const altText = imgElement.attr('alt') || modelNameRaw;
      
      if (!imgUrl) {
        continue; // Skip rows without an image
      }
      
      // Ensure the URL is absolute
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }
      
      // Remove thumbnail/scale modifiers
      let fullImgUrl = imgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

      // Determine casting name
      let castingName = modelNameRaw;
      let variantDescription: string | null = null;
      const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
        variantDescription = variantMatch[2].trim();
      }

      // Build safe folder path for this casting
      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Determine file extension
      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${toyNumber}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      // Download the image if not already downloaded
      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          totalDownloadCount++;
          console.log(`  Downloaded: ${castingName} → ${fileName}`);
        } catch (err) {
          console.error(`  Error downloading ${fullImgUrl}:`, err);
          continue;
        }
      }

      // Find variant by Toy# FIRST (PRIMARY MATCHING METHOD)
      let variant = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber,
          year: 2013,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
        include: {
          model: true,
        },
      });

      if (!variant) {
        console.warn(`  ⚠️  Variant not found for ${castingName} (Toy#: ${toyNumber})`);
        continue;
      }

      if (variant.imageId !== null && variant.imageId !== undefined) {
        // Variant already has an image assigned
        continue;
      }

      // Create Image record and associate with variant
      const relativePath = path.join('/images', 'hotwheels', '2013', 'mainline', castingSlug, fileName).replace(/\\/g, '/');
      try {
        const imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: altText,
            variant: { connect: { id: variant.id } },
          },
        });
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: imageRecord.id },
        });
        totalAssociatedCount++;
      } catch (err) {
        console.error(`  Error creating image record for ${castingName}:`, err);
      }
    }
  }

  console.log(`\n✅ Download complete. ${totalDownloadCount} images downloaded, ${totalAssociatedCount} variants updated.`);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

