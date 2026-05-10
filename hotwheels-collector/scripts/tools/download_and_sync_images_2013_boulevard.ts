/**
 * Script to download image assets for the 2013 Hot Wheels Boulevard series.
 * 
 * This script:
 *   1. Fetches the Boulevard table from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs
 *   3. Downloads images to public/images/hotwheels/2013/boulevard/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Boulevard-specific:
 * - Photo Carded: Main image (variant.imageId)
 * - Photo Loose: Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - No Series # column - use Toy # as cardNumber
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2013_boulevard.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import {
  findBoulevardVariantWithColorFallback,
  wikiImageUrlFromCheerioImg,
} from '../lib/boulevard-wiki-images.ts';
import {
  isLikelyWikiPlaceholderImageFile,
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceBoulevardFile,
} from '../lib/wiki-placeholder-image.ts';

const prisma = new PrismaClient();

const targetYear = 2013;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Hot_Wheels_Boulevard`;

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
 * Extract Mix name from table context (heading before table)
 * 2013 uses numbered Mixes: "Mix 1", "Mix 2", "Mix 3", "Mix 4"
 */
function extractMixName($: cheerio.CheerioAPI, table: any): string {
  let mixName = '';
  
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    // Match "Mix 1", "Mix 2", etc.
    const mixMatch = headingText.match(/mix\s*(\d+)/i);
    if (mixMatch) {
      mixName = `Mix ${mixMatch[1]}`;
    }
  }
  
  if (!mixName) {
    const caption = $(table).find('caption').text().trim();
    const mixMatch = caption.match(/mix\s*(\d+)/i);
    if (mixMatch) {
      mixName = `Mix ${mixMatch[1]}`;
    }
  }
  
  // Check if this is a valid data table (has "Toy #" header)
  const headerRow = $(table).find('thead tr, tbody tr').first();
  const firstHeader = headerRow.find('th, td').first().text().trim();
  
  // If not a data table, return empty to skip
  if (firstHeader !== 'Toy #') {
    return '';
  }
  
  return mixName || 'Mix 1';
}

async function main() {
  console.log('=== BOULEVARD IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);
  
  console.log(`Fetching ${targetYear} Boulevard page…`);
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);
  
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'boulevard');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  // Process each table (each Mix may have its own table)
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);
    
    // Skip if no mix name found or if it's a navigation table
    if (!mixName || /hot.*wheels.*boulevard/i.test(mixName)) {
      console.log(`Skipping ${mixName || 'unknown'} table`);
      continue;
    }
    
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Processing ${rows.length} rows from ${mixName}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      // Extract data based on known column structure for 2013
      // Column 0: Toy #
      // Column 1: Casting Name (link)
      // Column 2: Body Color
      // Column 3: Notes
      // Column 4: Photo Loose (resim)
      // Column 5: Photo Carded (resim)
      const toyNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      
      const castingNameLink = $(cells[1]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[1]).text().trim();
      
      const bodyColor = cells.length > 2 ? $(cells[2]).text().trim() : '';

      if (!toyNumber || !castingNameRaw) {
        continue;
      }

      const castingName = castingNameRaw;

      // Find model using nested query
      const model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeries: {
            name: mixName,
            collection: {
              name: 'Boulevard',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${mixName})`);
        continue;
      }

      // Build variant search query - match import script logic exactly
      // Import script uses: cardNumber = toyNumber, color: bodyColor || undefined
      const variantWhere: any = {
        modelId: model.id,
        cardNumber: toyNumber, // Use Toy # as cardNumber (no Series # exists)
        year: targetYear,
      };
      
      // Match import script: bodyColor || undefined
      // Empty string becomes undefined, which Prisma stores as NULL
      if (bodyColor && bodyColor.trim() !== '') {
        variantWhere.color = bodyColor.trim();
      } else {
        // bodyColor is empty, so search for NULL (what import script stored)
        variantWhere.color = null;
      }
      
      const variant = await findBoulevardVariantWithColorFallback(prisma, variantWhere);

      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${toyNumber}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Process Photo Carded (main image) - Column 5
      if (cells.length > 5) {
        const cardedImgElement = $(cells[5]).find('img').first();
        const cardedImgUrlRaw = wikiImageUrlFromCheerioImg(cardedImgElement);
        
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
          const fileName = `${toyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          if (isWikiPlaceholderOrMissingImageUrl(fullCardedUrl)) {
            console.warn(`Carded URL is wiki placeholder, skip: ${castingName}`);
            if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
          } else if (await shouldDownloadOrReplaceBoulevardFile(destPath)) {
            if (fs.existsSync(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
            try {
              await downloadImage(fullCardedUrl, destPath);
              if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
                console.warn(`Carded download still placeholder, removed: ${castingName}`);
              } else {
                downloadCount++;
                console.log(`Downloaded carded image: ${castingName} → ${fileName}`);
              }
            } catch (err) {
              console.error(`Error downloading carded image:`, err);
            }
          }

          // Associate as main image if variant doesn't have one
          if (!variant.imageId && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/boulevard/${castingSlug}/${fileName}`;
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

      // Process Photo Loose (second image) - Column 4
      if (cells.length > 4) {
        const looseImgElement = $(cells[4]).find('img').first();
        const looseImgUrlRaw = wikiImageUrlFromCheerioImg(looseImgElement);
        
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
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          // Check if loose image already exists in database
          const existingLooseImage = await prisma.image.findFirst({
            where: {
              variantId: variant.id,
              path: {
                contains: `${toyNumber}_loose`,
              },
            },
          });

          if (isWikiPlaceholderOrMissingImageUrl(fullLooseUrl)) {
            console.warn(`Loose URL is wiki placeholder, skip: ${castingName}`);
            if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
          } else if (await shouldDownloadOrReplaceBoulevardFile(destPath)) {
            if (fs.existsSync(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
            try {
              await downloadImage(fullLooseUrl, destPath);
              if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
                console.warn(`Loose download still placeholder, removed: ${castingName}`);
              } else {
                downloadCount++;
                console.log(`Downloaded loose image: ${castingName} → ${fileName}`);
              }
            } catch (err) {
              console.error(`Error downloading loose image:`, err);
            }
          }

          // Associate as second image if file exists and not already in DB
          if (!existingLooseImage && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/boulevard/${castingSlug}/${fileName}`;
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




