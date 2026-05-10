/**
 * Script to download image assets for the 2018 Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2018 mainline table from the Hot Wheels Fandom wiki and
 *      extracts the image URLs for each row (the last column in the table).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2018/mainline/{castingSlug}/` folder. The
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
 *     the 2018 mainline variants using the import script provided earlier.
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
 *        npx ts-node scripts/tools/download_and_sync_images_2018_mainline.ts
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

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2018_Hot_Wheels';

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
  console.log('Fetching 2018 mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not locate the mainline table on the page');
  }

  // Base folder for image storage. Adjust this if your project uses a different
  // public directory. According to our plan, images live in
  // public/images/hotwheels/2018/mainline/
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Process each row
  const rows = table.find('tbody tr');
  console.log(`Processing ${rows.length} rows for image download…`);
  let downloadCount = 0;
  let associatedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    // Extract data from row
    const toyNumber = $(cells[0]).text().trim();
    const collectorNumberStr = $(cells[1]).text().trim();
    const modelNameRaw = $(cells[2]).text().trim();
    const subSeriesName = $(cells[3]).text().trim();
    // Image element is in the 6th cell
    const imgElement = $(cells[5]).find('img');
    let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
    const altText = imgElement.attr('alt') || modelNameRaw;
    if (!imgUrl) {
      // Skip rows without an image
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
        console.log(`Downloaded image for ${castingName} → ${fileName}`);
      } catch (err) {
        console.error(`Error downloading ${fullImgUrl}:`, err);
      }
    }

    // Determine variant information in database
    // IMPORTANT: Match variant by Toy# FIRST - this is the most reliable way to match
    // Each variant (1st Color, 2nd Color, 3rd Color) has a unique Toy#
    // Images are saved with Toy# as filename, so we match by Toy# directly
    const mainlineCollection = await prisma.collection.findFirst({
      where: {
        name: 'Mainline',
        year: {
          year: 2018,
        },
      },
    });
    
    if (!mainlineCollection) {
      console.warn('2018 Mainline collection not found; skipping image association.');
      continue;
    }
    
    // Clean subSeriesName (same as import script)
    let cleanedSubSeriesName = subSeriesName.replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '').trim();
    cleanedSubSeriesName = cleanedSubSeriesName.replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '').trim();
    
    // IMPORTANT: Match variant by Toy# FIRST - this is the most reliable way to match
    let variant = await prisma.variant.findFirst({
      where: {
        toyNumber: toyNumber, // Match by Toy# - this is the primary matching method
        year: 2018,
        model: {
          collectionId: mainlineCollection.id,
        },
      },
      include: {
        model: true,
      },
    });

    // If variant found by Toy#, use its model
    let model = variant ? variant.model : null;

    // If still no model found, try to find it
    if (!model) {
      // Try to find model by castingName without parentheses content
      // This handles cases like "Nissan Skyline GT-R (BNR32)" where import script
      // saved it as "Nissan Skyline GT-R" but image script parsed it differently
      const baseCastingName = castingName.replace(/\s+\([^)]+\)$/, '').trim();
      const searchCastingName = baseCastingName !== castingName ? baseCastingName : castingName;
      
      model = await prisma.model.findFirst({
        where: {
          castingName: searchCastingName,
          collectionId: mainlineCollection.id,
          subSeries: {
            name: cleanedSubSeriesName,
            collectionId: mainlineCollection.id,
          },
        },
      });
      
      // If still not found, try without subSeriesName constraint
      if (!model) {
        model = await prisma.model.findFirst({
          where: {
            castingName: searchCastingName,
            collectionId: mainlineCollection.id,
          },
        });
      }
    }

    // If still no model and no variant found, skip
    if (!model && !variant) {
      console.warn(`Model and variant not found for ${castingName} (Toy#: ${toyNumber}); skipping image association.`);
      continue;
    }

    // If variant not found by Toy# but model found, try to find variant by Toy# within model
    if (!variant && model) {
      const foundVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: toyNumber,
        },
        include: {
          model: true,
        },
      });
      if (foundVariant) {
        variant = foundVariant;
      }
    }
    
    // Fallback: If Toy# match fails, try matching by cardNumber + color (for backwards compatibility)
    if (!variant && model) {
      const allVariantsWithCardNumber = await prisma.variant.findMany({
        where: {
          modelId: model.id,
          cardNumber: collectorNumberStr,
        },
        include: {
          model: true,
        },
      });
      
      // Try to match by color
      if (variantDescription) {
        const foundVariant = allVariantsWithCardNumber.find(v => 
          v.color && v.color.toLowerCase() === variantDescription.toLowerCase()
        );
        if (foundVariant) {
          variant = foundVariant;
        }
      }
      
      // If still not found and variantDescription is null/empty, try to find variant with null color
      if (!variant && !variantDescription) {
        const foundVariant = allVariantsWithCardNumber.find(v => v.color === null);
        if (foundVariant) {
          variant = foundVariant;
        }
      }
      
      // Last resort: use the first variant (fallback)
      if (!variant && allVariantsWithCardNumber.length > 0) {
        variant = allVariantsWithCardNumber[0];
        console.warn(`Toy# ${toyNumber} not found, using first variant with cardNumber ${collectorNumberStr} as fallback`);
      }
    }
    
    if (!variant) {
      console.warn(`Variant not found for ${castingName} (Toy#: ${toyNumber}, Card#: ${collectorNumberStr}); skipping image association.`);
      continue;
    }
    if (variant.imageId !== null && variant.imageId !== undefined) {
      // Variant already has an image assigned
      continue;
    }

    // Create Image record and associate with variant
    const relativePath = path.join('/images', 'hotwheels', '2018', 'mainline', castingSlug, fileName);
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
      associatedCount++;
      console.log(`Associated image with variant ${castingName} collector #${collectorNumberStr}`);
    } catch (err) {
      console.error(`Error creating image record for ${castingName}:`, err);
    }
  }

  console.log(`Download complete. ${downloadCount} images downloaded, ${associatedCount} variants updated.`);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

