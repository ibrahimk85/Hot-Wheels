/**
 * Script to download image assets for the 2020 Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2020 mainline table from the Hot Wheels Fandom wiki and
 *      extracts the image URLs for each row (the last column in the table).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2020/mainline/{castingSlug}/` folder. The
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
 *     the 2020 mainline variants using the import script provided earlier.
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
 *        npx ts-node scripts/tools/download_and_sync_images_2020_mainline.ts
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

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2020_Hot_Wheels';

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
  console.log('Fetching 2020 mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not locate the mainline table on the page');
  }

  // Base folder for image storage. Adjust this if your project uses a different
  // public directory. According to our plan, images live in
  // public/images/hotwheels/2020/mainline/
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2020', 'mainline');
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
    let subSeriesName = $(cells[3]).text().trim();
    
    // Clean subSeriesName - remove TH/STH markers and exclusive/store markers (same as import script)
    // This ensures we can find the model that was created with cleaned subSeriesName
    // Also remove "New for 2020!", "New in Mainline", etc. markers
    subSeriesName = subSeriesName
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
      .replace(/\s*New for 2020!\s*/gi, '')
      .replace(/\s*New in Mainline\s*/gi, '')
      .replace(/\s*New for 2020\s*/gi, '')
      .trim();
    
    // Handle empty subSeriesName - use "Mainline" as default (same as import script)
    // This ensures consistent subSeries matching between import and image scripts
    if (!subSeriesName || subSeriesName === '') {
      subSeriesName = 'Mainline';
    }
    
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
    let shouldTryMainlineSubSeries = false;
    const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
    if (variantMatch) {
      castingName = variantMatch[1].trim();
      const parsedDescription = variantMatch[2].trim();
      // Ignore "Mainline" as variantDescription - it's not a color variant,
      // just the subSeriesName repeated in parentheses
      if (parsedDescription.toLowerCase() !== 'mainline') {
        variantDescription = parsedDescription;
      } else {
        // If "(Mainline)" is in parentheses, this row might belong to "Mainline" subSeries
        // Mark that we should try "Mainline" subSeries if initial lookup fails
        shouldTryMainlineSubSeries = true;
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
        console.log(`Downloaded image for ${castingName} → ${fileName}`);
      } catch (err) {
        console.error(`Error downloading ${fullImgUrl}:`, err);
      }
    }

    // Determine variant information in database
    // First locate the model by castingName and subSeriesName
    // IMPORTANT: Use cleaned subSeriesName (same as import script) to find the correct model
    const mainlineCollection = await prisma.collection.findFirst({
      where: {
        name: 'Mainline',
        year: {
          year: 2020,
        },
      },
    });
    
    if (!mainlineCollection) {
      console.warn('2020 Mainline collection not found; skipping image association.');
      continue;
    }
    
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
    
    // If model not found and "(Mainline)" was in parentheses, try "Mainline" subSeries
    if (!model && shouldTryMainlineSubSeries && subSeriesName !== 'Mainline') {
      model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          collectionId: mainlineCollection.id,
          subSeries: {
            name: 'Mainline',
            collectionId: mainlineCollection.id,
          },
        },
      });
    }
    
    // If still not found, try without subSeriesName constraint (fallback)
    // This handles cases where wiki shows "(Mainline)" but model was imported with different subSeriesName
    if (!model) {
      model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          collectionId: mainlineCollection.id,
        },
      });
    }
    
    if (!model) {
      // Model might not exist if you haven't imported it yet
      console.warn(`Model not found for ${castingName} (${subSeriesName}); skipping image association.`);
      continue;
    }
    // Find the variant by cardNumber, color, and Toy# (for STH/TH variants)
    // IMPORTANT: Different colors (1st Color, 2nd Color, 3rd Color) for same Card# = different variants
    // IMPORTANT: STH variants have different Toy# (e.g., GTD10) than normal variants (e.g., GRY55)
    // IMPORTANT: TH variants have different Toy# (e.g., GTC96) than normal variants
    // We match by model + cardNumber + color + Toy# (via TH/STH flags) to find the correct variant
    
    // First, get all variants with this cardNumber to check for multiple variants
    const allVariantsWithCardNumber = await prisma.variant.findMany({
      where: {
        modelId: model.id,
        cardNumber: collectorNumberStr,
      },
    });
    
    let variant: typeof allVariantsWithCardNumber[0] | null = null;
    
    // If there are multiple variants, try to match by Toy# prefix first
    // For 2020: STH variants have GHG prefix, TH variants have GHD prefix
    // For 2021+: STH variants have GTD prefix, TH variants have GTC prefix
    // Normal variants have GRX/GRY/GTB/GHC/GHB prefix
    if (allVariantsWithCardNumber.length > 1) {
      // Try to match by STH flag (STH variants have GHG prefix for 2020, GTD for 2021+)
      if (toyNumber.startsWith('GHG') || toyNumber.startsWith('GTD')) {
        variant = allVariantsWithCardNumber.find(v => v.isSuperTreasureHunt === true) || null;
      }
      // Try to match by TH flag (TH variants have GHD prefix for 2020, GTC for 2021+)
      else if (toyNumber.startsWith('GHD') || toyNumber.startsWith('GTC')) {
        variant = allVariantsWithCardNumber.find(v => v.isTreasureHunt === true && v.isSuperTreasureHunt === false) || null;
      }
      // For normal variants (GRX/GRY/GTB/GHC/GHB prefix), exclude TH/STH variants
      else if (toyNumber.startsWith('GRX') || toyNumber.startsWith('GRY') || toyNumber.startsWith('GTB') || 
               toyNumber.startsWith('GHC') || toyNumber.startsWith('GHB')) {
        variant = allVariantsWithCardNumber.find(v => 
          v.isTreasureHunt === false && v.isSuperTreasureHunt === false
        ) || null;
      }
    }
    
    // If not found by Toy# prefix or if only one variant, try exact match with color
    if (!variant) {
      variant = allVariantsWithCardNumber.find(v => 
        v.color === (variantDescription ?? null)
      ) || null;
    }
    
    // If not found, try with exact color match (case-insensitive)
    if (!variant && variantDescription) {
      variant = allVariantsWithCardNumber.find(v => 
        v.color && v.color.toLowerCase() === variantDescription.toLowerCase()
      ) || null;
    }
    
    // If still not found and variantDescription is null/empty, try to find variant with null color
    if (!variant && !variantDescription) {
      variant = allVariantsWithCardNumber.find(v => v.color === null) || null;
    }
    
    // If still not found, use the first variant (fallback)
    // This ensures images are associated even if matching fails
    if (!variant && allVariantsWithCardNumber.length > 0) {
      variant = allVariantsWithCardNumber[0];
    }
    
    if (!variant) {
      console.warn(`Variant not found for ${castingName} collector #${collectorNumberStr} color ${variantDescription ?? 'default'}; skipping image association.`);
      continue;
    }
    if (variant.imageId !== null && variant.imageId !== undefined) {
      // Variant already has an image assigned
      continue;
    }

    // Create Image record and associate with variant
    const relativePath = path.join('/images', 'hotwheels', '2020', 'mainline', castingSlug, fileName);
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
