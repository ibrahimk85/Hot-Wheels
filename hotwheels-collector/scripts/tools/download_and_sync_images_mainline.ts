/**
 * Generic script to download image assets for Hot Wheels Mainline sets for any year (2000-2026)
 * and associate them with Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the mainline table from the Hot Wheels Fandom wiki for a specified year and
 *      extracts the image URLs for each row (the last column in the table).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/<year>/mainline/{castingSlug}/` folder. The
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
 *     the mainline variants using the import script provided earlier.
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
 *   2. Run with ts-node, providing the year as an argument:
 *        npx ts-node scripts/tools/download_and_sync_images_mainline.ts 2025
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import { getMainlineWikiUrlForYear } from '../lib/mainline-urls.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// Node 18 provides a global fetch API. If using an older Node version,
// install node-fetch and import it instead.

const prisma = new PrismaClient();

// Column mapping interface (same as import script)
interface ColumnMap {
  toy: number;        // Toy# or # column
  collector: number;  // Col.# column
  name: number;       // Name column
  series: number;     // Series column
  seriesInfo: number; // Series# or Note/Ratio column
  photo: number;      // Photo column
}

// Column mapping configuration by year (same as import script)
const columnMapByYear: Record<number, ColumnMap> = {
  // 2016-2026: Toy#, Col.#, Name, Series, Series#, Photo
  2016: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2017: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2018: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2019: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2020: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2021: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2022: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2023: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2024: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2025: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2026: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  // 2013-2015: Toy#, Col.#, Name, Series, Note/Ratio, Photo
  2013: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2014: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2015: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  // 2012 and earlier: #, Col.#, Name, Series, #, Photo
  2012: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2011: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2010: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2009: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2008: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2007: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2006: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2005: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2004: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2003: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2002: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2001: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
  2000: { toy: 0, collector: 1, name: 2, series: 3, seriesInfo: 4, photo: 5 },
};

/**
 * Get column mapping for a given year
 */
function getColumnMap(year: number): ColumnMap {
  return columnMapByYear[year] ?? columnMapByYear[2016]; // Default to 2016 structure
}

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
  // Get year from command line argument
  const yearArg = process.argv[2];
  if (!yearArg) {
    console.error('Please provide a year as an argument: npx ts-node scripts/tools/download_and_sync_images_mainline.ts 2025');
    process.exit(1);
  }
  
  const targetYear = parseInt(yearArg, 10);
  if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2026) {
    console.error('Year must be a number between 2000 and 2026');
    process.exit(1);
  }

  const url = getMainlineWikiUrlForYear(targetYear);
  console.log(`Fetching ${targetYear} mainline page from ${url}…`);

  const html = await fetchFandomWikiHtml(url);
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not locate the mainline table on the page');
  }

  // Get column mapping for this year
  const columnMap = getColumnMap(targetYear);

  // Base folder for image storage
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Process each row
  const rows = table.find('tbody tr');
  console.log(`Processing ${rows.length} rows for image download…`);
  let downloadCount = 0;
  let associatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    // Extract data from row using column mapping
    const toyNumber = $(cells[columnMap.toy]).text().trim();
    const collectorNumberStr = $(cells[columnMap.collector]).text().trim();
    const modelNameRaw = $(cells[columnMap.name]).text().trim();
    const subSeriesName = $(cells[columnMap.series]).text().trim();
    
    // Image element is in the photo column
    const imgElement = $(cells[columnMap.photo]).find('img');
    let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
    const altText = imgElement.attr('alt') || modelNameRaw;
    
    if (!imgUrl) {
      // Skip rows without an image
      continue;
    }
    
    // Skip rows with missing essential data
    if (!toyNumber || !modelNameRaw) {
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
        continue; // Skip this row if download fails
      }
    }

    // Determine variant information in database
    // First locate the model by castingName and subSeriesName
    const model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        subSeries: {
          name: subSeriesName,
        },
        collection: {
          name: 'Mainline',
          year: {
            year: targetYear,
          },
        },
      },
    });
    if (!model) {
      // Model might not exist if you haven't imported it yet
      console.warn(`Model not found for ${castingName} (${subSeriesName}) in year ${targetYear}; skipping image association.`);
      skippedCount++;
      continue;
    }
    
    // Find the variant by cardNumber and color
    const variant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: collectorNumberStr,
        color: variantDescription ?? undefined,
        year: targetYear,
      },
    });
    if (!variant) {
      console.warn(`Variant not found for ${castingName} collector #${collectorNumberStr} color ${variantDescription ?? 'default'} in year ${targetYear}; skipping image association.`);
      skippedCount++;
      continue;
    }
    
    if (variant.imageId !== null && variant.imageId !== undefined) {
      // Variant already has an image assigned
      skippedCount++;
      continue;
    }

    // Create Image record and associate with variant
    const relativePath = path.join('/images', 'hotwheels', targetYear.toString(), 'mainline', castingSlug, fileName).replace(/\\/g, '/');
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
      skippedCount++;
    }
  }

  console.log(`Download complete. ${downloadCount} images downloaded, ${associatedCount} variants updated, ${skippedCount} skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });












