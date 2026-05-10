/**
 * Script to download image assets for the 2026 Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2026 mainline table from the Hot Wheels Fandom wiki and
 *      extracts the image URLs for each row (the last column in the table).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2026/mainline/{castingSlug}/` folder. The
 *      file is named after the toy number from the table to guarantee
 *      uniqueness (e.g. `HYW18.jpg`).
 *   2. Looks up the corresponding Variant record in Prisma by Toy# (toyNumber)
 *      and creates an Image record associated with that variant if one does
 *      not already exist. The variant is then updated to reference its
 *      image.
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2026 mainline variants using the import script provided earlier.
 *   - The script assumes that the Year, Collection (Mainline) and
 *     SubSeries records already exist, and that each variant has been
 *     created with the proper toyNumber field.
 *   - The script matches variants by Toy# (toyNumber) for accurate pairing.
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
 *        npx ts-node scripts/tools/download_and_sync_images_2026_mainline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import { getMainlineWikiUrlForYear } from '../lib/mainline-urls.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Node 18 provides a global fetch API. If using an older Node version,
// install node-fetch and import it instead.

const TARGET_YEAR = 2026;

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

/**
 * Download mainline images and attach to variants by Toy#. Uses `mainline_urls.json` when `wikiUrl` is omitted.
 */
export async function runDownloadAndSyncImages2026Mainline(
  prisma: PrismaClient,
  wikiUrl?: string,
): Promise<void> {
  const pageUrl = wikiUrl ?? getMainlineWikiUrlForYear(TARGET_YEAR);
  console.log('Fetching 2026 mainline page…');
  const html = await fetchFandomWikiHtml(pageUrl);
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not locate the mainline table on the page');
  }

  // Base folder for image storage. Adjust this if your project uses a different
  // public directory. According to our plan, images live in
  // public/images/hotwheels/2026/mainline/
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2026', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Process each row
  const rows = table.find('tbody tr');
  console.log(`Processing ${rows.length} rows for image download…`);
  let downloadCount = 0;
  let associatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    try {
      // Extract data from row
      const toyNumber = $(cells[0]).text().trim();
      const collectorNumberStr = $(cells[1]).text().trim();
      const modelNameRaw = $(cells[2]).text().trim();
      const subSeriesName = $(cells[3]).text().trim();
      // Image element is in the 6th cell (index 5)
      const imgElement = $(cells[5]).find('img');
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
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
        .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '/revision/latest');

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
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)(\?|$)/);
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
          errorCount++;
          continue;
        }
      } else {
        downloaded = true; // Already exists
      }

      // Find variant by Toy# (toyNumber) - this is the key matching method
      // Handle empty toyNumber - skip if empty
      if (!toyNumber || toyNumber.trim() === '') {
        console.warn(`Empty Toy# for ${castingName} (COL#${collectorNumberStr}); skipping.`);
        skippedCount++;
        continue;
      }

      const variant = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber.trim(),
          year: TARGET_YEAR,
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
        skippedCount++;
        continue;
      }

      // Check if variant already has an image assigned
      if (variant.imageId !== null && variant.imageId !== undefined) {
        // Variant already has an image assigned
        if (i < 5) {
          console.log(`Variant ${castingName} (Toy#${toyNumber}) already has imageId: ${variant.imageId}`);
        }
        skippedCount++;
        continue;
      }

      // Create Image record and associate with variant
      const relativePath = path.join('/images', 'hotwheels', '2026', 'mainline', castingSlug, fileName)
        .replace(/\\/g, '/');
      
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
        console.log(`Associated image with variant ${castingName} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr})`);
      } catch (err) {
        console.error(`Error creating image record for ${castingName} (Toy#: ${toyNumber}):`, err);
        errorCount++;
      }
    } catch (err) {
      console.error(`Error processing row ${i + 1}:`, err);
      errorCount++;
    }
  }

  console.log(`\nDownload complete.`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Variants updated: ${associatedCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const prisma = new PrismaClient();
  runDownloadAndSyncImages2026Mainline(prisma)
    .catch((err) => {
      console.error(err);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
