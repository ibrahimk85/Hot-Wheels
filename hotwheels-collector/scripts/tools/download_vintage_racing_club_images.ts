/**
 * Script to download images for Vintage Racing Club Series variants.
 *
 * This script:
 *   1. Fetches Vintage Racing Club Series wiki page for 2024
 *   2. Parses the table to extract image URLs for each variant
 *   3. Downloads 2 image types: loose, carded (main)
 *   4. Creates Image records in the database
 *   5. Sets carded image as variant.imageId (main image)
 *
 * Table structure (0-indexed):
 *   Column 0: Series # (1/6, 2/6, etc.)
 *   Column 1: Toy # (HRV01, etc.)
 *   Column 2: Casting Name
 *   Column 3: Color
 *   Column 4: Tampos
 *   Column 5: Wheel Type
 *   Column 6: Notes (Base code(s))
 *   Column 7: Photo Loose
 *   Column 8: Photo Carded (main image)
 *
 * Image order:
 *   - Carded (order: 1) - main image (variant.imageId)
 *   - Loose (order: 2)
 *
 * How to use:
 *   npx ts-node scripts/tools/download_vintage_racing_club_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();

// Year to process
const YEAR = 2024;

// Image types and their order
// Table structure for Vintage Racing Club (9 columns):
// Column 0: Series #, Column 1: Toy #, Column 2: Casting Name, Column 3: Color,
// Column 4: Tampos, Column 5: Wheel Type, Column 6: Notes,
// Column 7: Photo Loose, Column 8: Photo Carded
function getImageTypes() {
  return [
    { type: 'carded', order: 1, columnIndex: 8, isMain: true },
    { type: 'loose', order: 2, columnIndex: 7, isMain: false },
  ] as const;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a casting name into a safe folder slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Clean image URL by removing thumbnail modifiers
 */
function cleanImageUrl(url: string): string {
  // Remove thumbnail/scale parameters from Fandom URLs
  let cleaned = url
    .replace(/\/revision\/[^/]+/, '')
    .replace(/\/scale-to-width-down\/\d+/, '')
    .replace(/\/scale-to-width\/\d+/, '')
    .replace(/\?.*$/, ''); // Remove query parameters

  // Ensure we have a full URL
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (cleaned.startsWith('/')) {
    cleaned = 'https://static.wikia.nocookie.net' + cleaned;
  }

  return cleaned;
}

/**
 * Download an image from URL and save to file
 */
async function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
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
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Fetch with retry mechanism to handle bot challenges
 */
async function fetchWithRetry(url: string, retries = 5, delay = 10000): Promise<string> {
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
      
      // Check if we got a bot challenge page
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page (HTML too short or contains "Client Challenge")');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms (${Math.round(delay/1000)}s) before retry…`);
        await sleep(delay);
        delay *= 2; // Exponential backoff (10s -> 20s -> 40s -> 80s -> 160s)
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

async function main() {
  console.log(`\n=== Processing Vintage Racing Club ${YEAR} ===`);

  // Delete existing images for this year's variants (to allow re-download)
  const variants = await prisma.variant.findMany({
    where: {
      year: YEAR,
      model: {
        collection: {
          name: 'Vintage Racing Club',
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

  // Build wiki URL
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Vintage_Racing_Club_Series_(2024)`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    process.exit(1);
  }

  const $ = cheerio.load(html);

  // Find all tables
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    console.error(`Could not find any tables on ${wikiUrl}`);
    process.exit(1);
  }

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', YEAR.toString(), 'vintage-racing-club');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process each table (Mix 1 and Mix 2)
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = $(tables[tableIndex]);
    
    // Get rows from tbody
    const rows = table.find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3; // At least Series #, Toy #, Casting Name
    });

    console.log(`Processing ${rows.length} rows from table ${tableIndex + 1}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract toy number and casting name
      // Table structure:
      // Column 0: Series #, Column 1: Toy #, Column 2: Casting Name
      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : ''; // Series #
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : ''; // Toy #
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : ''; // Casting Name

      // Toy number is in cell1
      let toyNumber: string | null = null;
      let castingNameRaw: string = '';
      
      // Extract toy number from cell1 (e.g., "HRV01")
      const cell1ToyMatch = cell1.match(/^([A-Z]{3}\d{2,3})$/);
      if (cell1ToyMatch) {
        toyNumber = cell1ToyMatch[1];
        castingNameRaw = cell2; // Casting name is in column 2
      } else {
        // Try to extract from cell1 if it contains the pattern
        const cell1ToyMatch2 = cell1.match(/([A-Z]{3}\d{2,3})/);
        if (cell1ToyMatch2) {
          toyNumber = cell1ToyMatch2[1];
          castingNameRaw = cell2;
        }
      }

      if (!toyNumber || !castingNameRaw) {
        console.warn(`Skipping row - toyNumber: "${toyNumber}", castingName: "${castingNameRaw}"`);
        skippedCount++;
        continue;
      }

      // Clean casting name (remove toy number if present, remove parentheses)
      let castingName = castingNameRaw.replace(toyNumber, '').trim();
      if (castingName.includes('(') && castingName.includes(')')) {
        castingName = castingName.replace(/\([^)]*\)/g, '').trim();
      }
      castingName = castingName.replace(/\s+/g, ' ').trim();

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Find variant by toyNumber and year
      const variant = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber,
          year: YEAR,
          model: {
            collection: {
              name: 'Vintage Racing Club',
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
        console.warn(`Variant not found for Toy# "${toyNumber}" (${castingName}, Year: ${YEAR}); skipping.`);
        skippedCount++;
        continue;
      }

      // Get image types
      const imageTypes = getImageTypes();
      
      // Process each image type (carded first to set as main image)
      for (const imageType of imageTypes) {
        const cellIndex = imageType.columnIndex;
        if (cells.length <= cellIndex) {
          // Image column doesn't exist, skip
          continue;
        }

        const imgElement = $(cells[cellIndex]).find('img').first();
        let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');

        if (!imgUrl) {
          // No image for this type, skip
          continue;
        }

        // Clean and prepare image URL
        const fullImgUrl = cleanImageUrl(imgUrl);
        const altText = imgElement.attr('alt') || `${castingName} - ${imageType.type}`;

        // Determine file extension
        const urlObj = new URL(fullImgUrl);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `${toyNumber}_${imageType.type}.${ext}`;
        const destPath = path.join(targetFolder, fileName);

        // Check if image already exists for this variant with this type
        const existingImage = variant.images.find(
          img => img.notes === imageType.type
        );

        if (existingImage) {
          // Image record already exists, skip
          skippedCount++;
          continue;
        }

        // Download the image if not already downloaded
        if (!fs.existsSync(destPath)) {
          try {
            await downloadImage(fullImgUrl, destPath);
            downloadCount++;
            console.log(`Downloaded ${imageType.type} image for ${castingName} (Toy#: ${toyNumber}) → ${fileName}`);
          } catch (err) {
            console.error(`Error downloading ${fullImgUrl}:`, err);
            errorCount++;
            continue;
          }
        }

        // Create Image record
        const relativePath = path.join('/images', 'hotwheels', YEAR.toString(), 'vintage-racing-club', castingSlug, fileName)
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
          
          // If this is the carded (main) image, set it as variant.imageId
          if (imageType.isMain) {
            await prisma.variant.update({
              where: { id: variant.id },
              data: { imageId: imageRecord.id },
            });
          }
          
          createdCount++;
          console.log(`Created ${imageType.type} image record for ${castingName} (Toy#: ${toyNumber})${imageType.isMain ? ' [MAIN]' : ''}`);
        } catch (err) {
          console.error(`Error creating ${imageType.type} image record for ${castingName} (Toy#: ${toyNumber}):`, err);
          errorCount++;
        }
      }
    }
  }

  console.log(`\n=== Download completed ===`);
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
