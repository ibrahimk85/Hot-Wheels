/**
 * Script to download image assets for the 2025 Hot Wheels Pop Culture series.
 * 
 * This script:
 *   1. Fetches the Pop Culture table from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs
 *   3. Downloads images to public/images/hotwheels/2025/pop-culture/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Pop Culture-specific:
 * - Photo Carded: Main image (variant.imageId)
 * - Photo Loose: Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - Variant matching uses: Theme + Toy# + Casting Name (CRITICAL!)
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2025_pop_culture.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2025;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Pop_Culture`;

/**
 * Sanitize a string for use as a Windows file/folder name
 * Removes or replaces invalid characters: < > : " / \ | ? *
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove Windows invalid characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function slugify(name: string): string {
  // First sanitize for Windows, then create slug
  const sanitized = sanitizeFileName(name);
  return sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  // Ensure directory exists before writing file
  const dir = path.dirname(dest);
  await fs.promises.mkdir(dir, { recursive: true });
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

/**
 * Extract sub-series name from table context (heading before table)
 * For Pop Culture, sub-series names vary (not standardized like Boulevard Mix)
 */
function extractSubSeriesName($: cheerio.CheerioAPI, table: any): string {
  // Try to find heading before table
  let subSeriesName = '';
  
  // Check previous h2, h3, h4 elements
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    // Skip generic headings like "Contents", "References", etc.
    if (!/^(contents|references|see also|external links|categories)$/i.test(headingText)) {
      subSeriesName = headingText;
    }
  }
  
  // Check table caption
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption;
    }
  }
  
  // Check for span.mw-headline (Fandom wiki heading structure)
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText;
      }
    }
  }
  
  // Default fallback
  return subSeriesName || 'Unknown Series';
}

async function main() {
  console.log('=== POP CULTURE IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);
  
  console.log(`Fetching ${targetYear} Pop Culture page…`);
  const resp = await fetch(WIKI_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);
  
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'pop-culture');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  // Process each table (each sub-series may have its own table)
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    // Skip tables with generic or invalid names
    if (/^(contents|references|see also|external links|categories|team transport)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }
    
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Processing ${rows.length} rows from ${subSeriesName}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      // Extract data based on known column structure for 2025
      // NOTE: Column order may vary - verify against actual wiki page
      // Expected: Series #, Toy #, Casting Name, Theme, Body Color, Wheel Type, Notes, Photo Loose, Photo Carded
      // Adjust indices below if the actual table structure differs
      const seriesNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      
      const castingNameLink = $(cells[2]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[2]).text().trim();
      
      const theme = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const bodyColor = cells.length > 4 ? $(cells[4]).text().trim() : '';

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        continue;
      }

      const castingName = castingNameRaw;

      // Find model using nested query
      const model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeries: {
            name: subSeriesName,
            collection: {
              name: 'Pop Culture',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${subSeriesName})`);
        continue;
      }

      // Build variant search query - CRITICAL: Use Theme + Toy# + Casting Name for matching
      // This is the key difference from Car Culture
      const variantWhere: any = {
        modelId: model.id,
        cardNumber: seriesNumber,
        year: targetYear,
      };
      
      // Include theme in matching (Pop Culture specific)
      if (theme && theme.trim() !== '') {
        variantWhere.theme = theme.trim();
      } else {
        variantWhere.theme = null;
      }
      
      // Match import script: bodyColor || undefined
      // Empty string becomes undefined, which Prisma stores as NULL
      if (bodyColor && bodyColor.trim() !== '') {
        variantWhere.color = bodyColor.trim();
      } else {
        // bodyColor is empty, so search for NULL (what import script stored)
        variantWhere.color = null;
      }
      
      const variant = await prisma.variant.findFirst({
        where: variantWhere,
      });

      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${seriesNumber} Theme: ${theme || 'N/A'}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Process Photo Carded (main image)
      // NOTE: Adjust column index based on actual table structure
      // Expected: Photo Carded is typically the last column
      const cardedColIdx = cells.length - 1; // Last column
      if (cells.length > cardedColIdx) {
        const cardedImgElement = $(cells[cardedColIdx]).find('img').first();
        const cardedImgUrlRaw = cardedImgElement.attr('data-src') || cardedImgElement.attr('src');
        
        if (cardedImgUrlRaw) {
          // Ensure the URL is absolute
          let cardedImgUrl = cardedImgUrlRaw;
          if (cardedImgUrl.startsWith('//')) {
            cardedImgUrl = 'https:' + cardedImgUrl;
          }
          // Derive the full‑size image URL by removing thumbnail/scale modifiers
          let fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(`${fullCardedUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          // Sanitize toyNumber for Windows file names
          const sanitizedToyNumber = sanitizeFileName(toyNumber);
          const fileName = `${sanitizedToyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          // Download if not exists
          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(fullCardedUrl, destPath);
              downloadCount++;
              console.log(`Downloaded carded image: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading carded image:`, err);
            }
          }

          // Associate as main image if variant doesn't have one
          if (!variant.imageId && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/pop-culture/${castingSlug}/${fileName}`;
            try {
              const imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Carded)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              await prisma.variant.update({
                where: { id: variant.id },
                data: { imageId: imageRecord.id },
              });
              associatedCount++;
              console.log(`Associated carded image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating carded image:`, err);
            }
          }
        }
      }

      // Process Photo Loose (second image)
      // NOTE: Adjust column index based on actual table structure
      // Expected: Photo Loose is typically second to last column
      const looseColIdx = cells.length - 2; // Second to last column
      if (cells.length > looseColIdx && looseColIdx >= 0) {
        const looseImgElement = $(cells[looseColIdx]).find('img').first();
        const looseImgUrlRaw = looseImgElement.attr('data-src') || looseImgElement.attr('src');
        
        if (looseImgUrlRaw) {
          // Ensure the URL is absolute
          let looseImgUrl = looseImgUrlRaw;
          if (looseImgUrl.startsWith('//')) {
            looseImgUrl = 'https:' + looseImgUrl;
          }
          // Derive the full‑size image URL by removing thumbnail/scale modifiers
          let fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(`${fullLooseUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          // Sanitize toyNumber for Windows file names
          const sanitizedToyNumber = sanitizeFileName(toyNumber);
          const fileName = `${sanitizedToyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          // Check if loose image already exists in database
          const existingLooseImage = await prisma.image.findFirst({
            where: {
              variantId: variant.id,
              path: {
                contains: `${sanitizedToyNumber}_loose`,
              },
            },
          });

          // Download if not exists
          if (!fs.existsSync(destPath) && !existingLooseImage) {
            try {
              await downloadImage(fullLooseUrl, destPath);
              downloadCount++;
              console.log(`Downloaded loose image: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading loose image:`, err);
            }
          }

          // Associate as second image if file exists and not already in DB
          if (!existingLooseImage && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/pop-culture/${castingSlug}/${fileName}`;
            try {
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated loose image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating loose image:`, err);
            }
          }
        }
      }
    }
  }

  console.log(`\nDownload complete. ${downloadCount} images downloaded, ${associatedCount} images associated.`);
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

