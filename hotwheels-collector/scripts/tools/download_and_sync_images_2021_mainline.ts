/**
 * Script to download image assets for the 2021 Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2021 mainline table from the Hot Wheels Fandom wiki and
 *      extracts the image URLs for each row (the last column in the table).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2021/mainline/{castingSlug}/` folder. The
 *      file is named after the toy number from the table to guarantee
 *      uniqueness (e.g. `HYW18.jpg`).
 *   2. Looks up the corresponding Variant record in Prisma (by
 *      casting name, sub‑series name, collector number, and color variant)
 *      and creates an Image record associated with that variant if one does
 *      not already exist. The variant is then updated to reference its
 *      image.
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2021 mainline variants using the import script provided earlier.
 *   - The script assumes that the Year, Collection (Mainline) and
 *     SubSeries records already exist, and that each variant has been
 *     created with the proper cardNumber and color fields.
 *   - The script skips downloading an image if the file already exists
 *     locally and skips creating an Image record if the variant already
 *     references one (via imageId).
 *   - Running this script multiple times is safe; it will only download
 *     missing images and create missing associations.
 *
 * Usage:
 *   1. Install cheerio if you haven't already:
 *        npm install cheerio
 *
 *   2. Place this file in your project (e.g. `scripts/tools/`)
 *
 *   3. Run with ts-node:
 *        npx ts-node scripts/tools/download_and_sync_images_2021_mainline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// Node 18 provides a global fetch API. If using an older Node version,
// install node-fetch and import it instead.

const prisma = new PrismaClient();

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2021_Hot_Wheels';

/**
 * Convert a casting name into a safe folder slug. Lowercases the string,
 * replaces non‑alphanumeric characters with hyphens and trims hyphens from
 * the start or end.
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
  console.log('Fetching 2021 mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not locate the mainline table on the page');
  }

  // Base folder for image storage. Adjust this if your project uses a different
  // public directory. According to our plan, images live in
  // public/images/hotwheels/2021/mainline/
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2021', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Process each row
  const rows = table.find('tbody tr');
  console.log(`Processing ${rows.length} rows for image download…`);
  
  // Check table structure
  let expectedCellCount = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const testRow = rows[i];
    const testCells = $(testRow).find('td');
    if (testCells.length > 0) {
      expectedCellCount = Math.max(expectedCellCount, testCells.length);
    }
  }
  console.log(`Table structure detected: ${expectedCellCount} columns`);

  let downloadCount = 0;
  let associatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    // Skip rows with insufficient cells
    if (cells.length < 3) {
      skippedCount++;
      continue;
    }

    // Extract data from row - dynamically handle different table structures
    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const modelNameRaw = cells.length > 2 ? $(cells[2]).text().trim() : '';
    let subSeriesNameRaw = cells.length > 3 ? $(cells[3]).text().trim() : '';

    // Skip rows with empty Toy# or Model Name
    if (!toyNumber || !modelNameRaw) {
      skippedCount++;
      continue;
    }
    
    // Clean subSeriesName - remove TH/STH markers and exclusive/store markers (same as import script)
    // This ensures we can find the model that was created with cleaned subSeriesName
    // Also remove "New for 2021!", "New in Mainline", etc. markers
    let subSeriesName = subSeriesNameRaw
      .replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '')
      .replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '')
      .replace(/\s*Super\s*$/gi, '') // Remove "Super" at the end
      .replace(/\s*Walmart Exclusive\s*/gi, '')
      .replace(/\s*Kroger Exclusive\s*/gi, '')
      .replace(/\s*Target Exclusive\s*/gi, '')
      .replace(/\s*Dollar General Exclusive\s*/gi, '')
      .replace(/\s*GameStop Exclusive\s*/gi, '')
      .replace(/\s*Walgreens Exclusive\s*/gi, '')
      .replace(/\s*Red Edition\s*/gi, '') // Red Edition is in seriesInfo, not subSeriesName
      .replace(/\s*New for 2021!\s*/gi, '')
      .replace(/\s*New in Mainline\s*/gi, '')
      .replace(/\s*New for 2021\s*/gi, '')
      .trim();
    
    // Handle empty subSeriesName - use "Mainline" as default (same as import script)
    // This ensures consistent subSeries matching between import and image scripts
    if (!subSeriesName || subSeriesName === '') {
      subSeriesName = 'Mainline';
    }
    
    // Image element - try to find in last cell or cells with img tag
    let imgElement: ReturnType<typeof $> | null = null;
    // Try last cell first (most common structure)
    if (cells.length > 5) {
      const lastCellImg = $(cells[cells.length - 1]).find('img').first();
      if (lastCellImg && lastCellImg.length > 0) {
        imgElement = lastCellImg;
      }
    }
    // If not found, search all cells for image
    if (!imgElement || imgElement.length === 0) {
      for (let j = cells.length - 1; j >= 0; j--) {
        const cellImg = $(cells[j]).find('img').first();
        if (cellImg && cellImg.length > 0) {
          imgElement = cellImg;
          break;
        }
      }
    }
    
    if (!imgElement || imgElement.length === 0) {
      skippedCount++;
      continue;
    }
    
    let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
    const altText = imgElement.attr('alt') || modelNameRaw;
    if (!imgUrl) {
      // Skip rows without an image
      skippedCount++;
      continue;
    }
    // Ensure the URL is absolute
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    }
    // Derive the full‑size image URL by removing thumbnail/scale modifiers.
    // Fandom often appends paths like `/revision/latest/scale-to-width-down/250` or
    // `/thumbnail/width/250/height/250` to reduce image size. Remove these segments
    // to fetch the largest available version. Do not remove the query string (cb).
    let fullImgUrl = imgUrl
      .replace(/\/scale-to-width-down\/\d+/g, '')
      .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

    // Determine casting name and variant description from modelNameRaw
    // IMPORTANT: Parse model name exactly like import script does
    let castingName = modelNameRaw;
    let variantDescription: string | null = null;
    const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
    if (variantMatch) {
      castingName = variantMatch[1].trim();
      const parsedDescription = variantMatch[2].trim();
      // Ignore "Mainline" as variantDescription - it's not a color variant,
      // just the subSeriesName repeated in parentheses
      if (parsedDescription.toLowerCase() !== 'mainline') {
        variantDescription = parsedDescription;
      }
    }

    // Build safe folder path for this casting
    const castingSlug = slugify(castingName);
    const targetFolder = path.join(baseDir, castingSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    // Determine file extension from the full image URL
    const urlObj = new URL(fullImgUrl);
    const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const fileName = `${toyNumber}.${ext}`;
    const destPath = path.join(targetFolder, fileName);

    // Download the image if not already downloaded
    let downloaded = false;
    if (!fs.existsSync(destPath)) {
      try {
        await downloadImage(fullImgUrl, destPath);
        downloaded = true;
        downloadCount++;
        console.log(`Downloaded image for ${castingName} (Toy#: ${toyNumber}) → ${fileName}`);
      } catch (err) {
        console.error(`Error downloading ${fullImgUrl}:`, err);
        continue;
      }
    } else {
      downloaded = true; // Already exists
    }

    // Determine variant information in database
    // First locate the model by castingName and subSeriesName
    // IMPORTANT: Use cleaned subSeriesName (same as import script) to find the correct model
    const mainlineCollection = await prisma.collection.findFirst({
      where: {
        name: 'Mainline',
        year: {
          year: 2021,
        },
      },
    });
    
    if (!mainlineCollection) {
      console.warn('2021 Mainline collection not found; skipping image association.');
      continue;
    }
    
    // Try to find model - first by exact castingName and subSeriesName match
    let model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        collectionId: mainlineCollection.id,
        subSeries: {
          name: subSeriesName,
          collectionId: mainlineCollection.id,
        },
      },
    });
    
    // If not found, try without subSeriesName constraint (fallback)
    // This handles cases where model name parsing differs slightly
    if (!model) {
      model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          collectionId: mainlineCollection.id,
        },
      });
    }
    
    // If still not found, try with base castingName (remove parenthetical parts)
    // This handles cases like "'17 Nissan GT-R (R35)" vs "'17 Nissan GT-R"
    if (!model) {
      const baseCastingName = castingName.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (baseCastingName !== castingName && baseCastingName.length > 0) {
        // Try with subSeriesName first
        model = await prisma.model.findFirst({
          where: {
            castingName: baseCastingName,
            collectionId: mainlineCollection.id,
            subSeries: {
              name: subSeriesName,
              collectionId: mainlineCollection.id,
            },
          },
        });
        
        // If still not found, try without subSeriesName
        if (!model) {
          model = await prisma.model.findFirst({
            where: {
              castingName: baseCastingName,
              collectionId: mainlineCollection.id,
            },
          });
        }
      }
    }
    
    if (!model) {
      // Model might not exist if you haven't imported it yet
      console.warn(`Model not found for ${castingName} (${subSeriesName}); skipping image association.`);
      continue;
    }
    // Find variant by Toy# (toyNumber) - this is the key matching method
    // Handle empty toyNumber - skip if empty
    if (!toyNumber || toyNumber.trim() === '') {
      console.warn(`Empty Toy# for ${castingName} (COL#${collectorNumberStr}); skipping.`);
      continue;
    }

    const variant = await prisma.variant.findFirst({
      where: {
        toyNumber: toyNumber.trim(),
        year: 2021,
      },
      include: {
        model: {
          include: {
            collection: true,
          },
        },
      },
    });
    
    if (!variant) {
      console.warn(`Variant not found for Toy# "${toyNumber}" (${castingName}, COL#${collectorNumberStr}); skipping image association.`);
      continue;
    }
    // Check if variant already has an image assigned
    if (variant.imageId !== null && variant.imageId !== undefined) {
      // Check if the image file still exists
      const existingImage = await prisma.image.findUnique({
        where: { id: variant.imageId },
      });
      if (existingImage && fs.existsSync(path.join(process.cwd(), 'public', existingImage.path))) {
        // Variant already has an image assigned and file exists
        continue;
      }
      // If image record exists but file is missing, we'll create a new one
    }

    // Create Image record and associate with variant
    const relativePath = path.join('/images', 'hotwheels', '2021', 'mainline', castingSlug, fileName).replace(/\\/g, '/');
    try {
      // Check if image record already exists for this path
      let imageRecord = await prisma.image.findFirst({
        where: {
          path: relativePath,
        },
      });

      if (!imageRecord) {
        imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: altText,
            variant: { connect: { id: variant.id } },
          },
        });
      } else {
        // Update existing image record to link to this variant if not already linked
        if (imageRecord.variantId !== variant.id) {
          await prisma.image.update({
            where: { id: imageRecord.id },
            data: {
              variant: { connect: { id: variant.id } },
            },
          });
        }
      }

      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: imageRecord.id },
      });
      associatedCount++;
      if (associatedCount % 50 === 0) {
        console.log(`Progress: ${associatedCount} images associated...`);
      }
    } catch (err) {
      console.error(`Error creating image record for ${castingName} (Toy#: ${toyNumber}):`, err);
      errorCount++;
    }
  }

  console.log(`\nDownload complete.`);
  console.log(`Downloaded: ${downloadCount} images`);
  console.log(`Associated: ${associatedCount} variants`);
  console.log(`Skipped: ${skippedCount} rows`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

