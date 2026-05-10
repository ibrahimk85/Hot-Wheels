/**
 * Script to download images for 2018 Pearl&Chrome Anniversary Series (50th Anniversary Black and Gold Series).
 *
 * This script:
 *   1. Fetches the wiki page for 2018
 *   2. Parses the table to extract image URLs for each variant
 *   3. Downloads 2 image types: loose, carded (main)
 *   4. Creates Image records in the database
 *   5. Sets carded image as variant.imageId (main image)
 *
 * Table structure:
 *   Column 0: Col # (Series #)
 *   Column 1: Toy # (Card Number)
 *   Column 2: Casting Name
 *   Column 3: Color
 *   Column 4: Tampo
 *   Column 5: Wheel Type
 *   Column 6: Notes
 *   Column 7: Photo Loose
 *   Column 8: Photo Carded
 *
 * Image order:
 *   - Carded (order: 1) - main image (variant.imageId)
 *   - Loose (order: 2)
 *
 * How to use:
 *   npx ts-node scripts/tools/download_pearl_chrome_anniversary_2018.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();
const YEAR = 2018;
const COLLECTION_NAME = 'Pearl&Chrome Anniversary Series';
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/50th_Anniversary_Black_and_Gold_Series_(2018)';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanImageUrl(url: string): string {
  let cleaned = url
    .replace(/\/revision\/[^/]+/, '')
    .replace(/\/scale-to-width-down\/\d+/, '')
    .replace(/\/scale-to-width\/\d+/, '')
    .replace(/\?.*$/, '');

  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (cleaned.startsWith('/')) {
    cleaned = 'https://static.wikia.nocookie.net' + cleaned;
  }

  return cleaned;
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location || url, destPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://hotwheels.fandom.com/'
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms before retry…`);
        await sleep(delay);
        delay *= 1.5;
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

async function main() {
  console.log(`\n=== Processing Year ${YEAR} ===`);

  // Delete existing images for this year's variants
  const variants = await prisma.variant.findMany({
    where: {
      year: YEAR,
      model: {
        collection: {
          name: COLLECTION_NAME,
          year: {
            year: YEAR,
          },
        },
      },
    },
  });

  if (variants.length > 0) {
    console.log('Deleting existing images...');
    for (const variant of variants) {
      await prisma.image.deleteMany({
        where: { variantId: variant.id },
      });
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: null },
      });
    }
    console.log(`Deleted images for ${variants.length} variants`);
  }

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(WIKI_URL);
  } catch (error) {
    console.error(`Failed to fetch ${WIKI_URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find the main table
  const table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    console.error(`Could not find any tables on ${WIKI_URL}`);
    return;
  }

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', YEAR.toString(), 'pearl-chrome-anniversary');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const rows = table.find('tbody tr');
  console.log(`Processing ${rows.length} rows…`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    const cardNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const castingName = cells.length > 2 ? $(cells[2]).text().trim() : '';

    if (!cardNumber || !castingName) {
      skippedCount++;
      continue;
    }

    const cleanCastingName = castingName.replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
    const castingSlug = slugify(cleanCastingName);
    const targetFolder = path.join(baseDir, castingSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    // Find variant by cardNumber and year
    const variant = await prisma.variant.findFirst({
      where: {
        cardNumber: cardNumber,
        year: YEAR,
        model: {
          collection: {
            name: COLLECTION_NAME,
            year: {
              year: YEAR,
            },
          },
        },
      },
      include: {
        images: true,
      },
    });

    if (!variant) {
      console.warn(`Variant not found for Card# "${cardNumber}" (${cleanCastingName}, Year: ${YEAR}); skipping.`);
      skippedCount++;
      continue;
    }

    // Image types: loose (column 7), carded (column 8)
    const imageTypes = [
      { type: 'carded', order: 1, columnIndex: 8, isMain: true },
      { type: 'loose', order: 2, columnIndex: 7, isMain: false },
    ] as const;

    // Process each image type (carded first to set as main image)
    for (const imageType of imageTypes) {
      const cellIndex = imageType.columnIndex;
      if (cells.length <= cellIndex) {
        continue;
      }

      const imgElement = $(cells[cellIndex]).find('img').first();
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');

      if (!imgUrl) {
        continue;
      }

      const fullImgUrl = cleanImageUrl(imgUrl);
      const altText = imgElement.attr('alt') || `${cleanCastingName} - ${imageType.type}`;

      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${cardNumber}_${imageType.type}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      const existingImage = variant.images.find(
        img => img.notes === imageType.type
      );

      if (existingImage) {
        skippedCount++;
        continue;
      }

      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          downloadCount++;
          console.log(`Downloaded ${imageType.type} image for ${cleanCastingName} (Card#: ${cardNumber}) → ${fileName}`);
        } catch (err) {
          console.error(`Error downloading ${fullImgUrl}:`, err);
          errorCount++;
          continue;
        }
      }

      const relativePath = path.join('/images', 'hotwheels', YEAR.toString(), 'pearl-chrome-anniversary', castingSlug, fileName)
        .replace(/\\/g, '/');

      try {
        const imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: altText,
            variant: { connect: { id: variant.id } },
            notes: imageType.type,
            order: imageType.order,
          },
        });
        
        if (imageType.isMain) {
          await prisma.variant.update({
            where: { id: variant.id },
            data: { imageId: imageRecord.id },
          });
        }
        
        createdCount++;
        console.log(`Created ${imageType.type} image record for ${cleanCastingName} (Card#: ${cardNumber})${imageType.isMain ? ' [MAIN]' : ''}`);
      } catch (err) {
        console.error(`Error creating ${imageType.type} image record for ${cleanCastingName} (Card#: ${cardNumber}):`, err);
        errorCount++;
      }
    }
  }

  console.log(`\n=== Year ${YEAR} completed ===`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Image records created: ${createdCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
