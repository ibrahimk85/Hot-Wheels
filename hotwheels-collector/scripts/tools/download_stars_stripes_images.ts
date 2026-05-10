/**
 * Script to download images for Stars & Stripes Series variants.
 *
 * This script:
 *   1. Fetches Stars & Stripes Series wiki page for the specified year(s)
 *   2. Parses the table to extract image URLs for each variant
 *   3. Downloads 2 image types: loose, carded (main)
 *   4. Creates Image records in the database
 *   5. Sets carded image as variant.imageId (main image)
 *
 * Table structure (0-indexed):
 *   Column 0: Series # (1/5, 2/5, etc.)
 *   Column 1: Toy # (HRW62, etc.)
 *   Column 2: Casting Name
 *   Column 3: Body Color
 *   Column 4: Tampo
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
 *   # From the hotwheels-collector directory:
 *   # Download images for single year
 *   npx ts-node scripts/tools/download_stars_stripes_images.ts 2024
 *
 *   # Download images for all years (2016, 2018, 2020, 2022, 2024)
 *   npx ts-node scripts/tools/download_stars_stripes_images.ts
 *
 *   # From the parent directory (C:\Hot_Wheels):
 *   npx ts-node hotwheels-collector/scripts/tools/download_stars_stripes_images.ts 2024
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();

// Years to process
const YEARS = [2016, 2018, 2020, 2022, 2024];

// Image types and their order
// Table structure for Stars & Stripes (9 columns):
// Column 0: Series #, Column 1: Toy #, Column 2: Casting Name, Column 3: Body Color,
// Column 4: Tampo, Column 5: Wheel Type, Column 6: Notes,
// Column 7: Photo Loose, Column 8: Photo Carded
function getImageTypesForYear(year: number) {
  // All years have the same structure for Stars & Stripes
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
async function downloadImage(url: string, destPath: string, redirectCount = 0): Promise<void> {
  const MAX_REDIRECTS = 5;
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects for ${url}`);
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
        // Handle redirect
        const location = response.headers.location || response.headers['location'] || (response.headers as any).Location;
        if (!location) {
          reject(new Error(`Redirect without location header for ${url}`));
          return;
        }
        
        // Resolve relative URLs
        let redirectUrl: string;
        try {
          redirectUrl = new URL(location, url).href;
        } catch (err) {
          reject(new Error(`Invalid redirect URL: ${location} (from ${url})`));
          return;
        }
        
        if (redirectUrl === url) {
          reject(new Error(`Redirect loop detected for ${url}`));
          return;
        }
        
        return downloadImage(redirectUrl, destPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      
      if (statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${statusCode}`));
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
  // More realistic browser headers to avoid bot detection
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { 
        headers,
        redirect: 'follow',
        // Add a small random delay to appear more human-like
      });
      
      const statusCode = resp.status;
      
      // Handle 403 specifically with longer delays
      if (statusCode === 403) {
        if (attempt < retries) {
          // For 403, use longer delays (30s, 60s, 120s, 240s, 480s)
          const forbiddenDelay = 30000 * Math.pow(2, attempt - 1);
          console.warn(`403 Forbidden - waiting ${forbiddenDelay}ms (${Math.round(forbiddenDelay/1000)}s) before retry…`);
          await sleep(forbiddenDelay);
          continue; // Retry with same attempt number logic
        } else {
          throw new Error(`HTTP ${statusCode}: ${resp.statusText} - Blocked by server after ${retries} attempts`);
        }
      }
      
      if (!resp.ok) {
        throw new Error(`HTTP ${statusCode}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      // Check if we got a bot challenge page
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page (HTML too short or contains "Client Challenge")');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Attempt ${attempt} failed:`, errorMessage);

      if (attempt < retries) {
        // For non-403 errors, use standard exponential backoff
        const isForbidden = errorMessage.includes('403') || errorMessage.includes('Forbidden');
        const currentDelay = isForbidden ? 30000 * Math.pow(2, attempt - 1) : delay;
        console.log(`Waiting ${currentDelay}ms (${Math.round(currentDelay/1000)}s) before retry…`);
        await sleep(currentDelay);
        if (!isForbidden) {
          delay *= 2; // Exponential backoff for non-403 errors
        }
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

/**
 * Process a single year's images
 */
async function processYear(year: number) {
  console.log(`\n=== Processing Year ${year} ===`);

  // Check if collection exists
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Stars & Stripes',
      year: {
        year: year,
      },
    },
  });

  if (!collection) {
    console.error(`Collection "Stars & Stripes" not found for year ${year}. Please ensure the collection exists in the database.`);
    return;
  }

  // Delete existing images for this year's variants (to allow re-download)
  const variants = await prisma.variant.findMany({
    where: {
      year: year,
      model: {
        collection: {
          name: 'Stars & Stripes',
          year: {
            year: year,
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

  // Build wiki URL - all years are on the same page
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Stars_%26_Stripes_Series`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find the year heading and get tables for that year
  let tablesToProcess;
  
  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(year)) && !text.includes(String(year - 1)) && !text.includes(String(year + 1));
  }).first();

  if (yearHeading.length > 0) {
    // Find all tables after year heading until next year heading
    const nextYearHeading = yearHeading.nextAll('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return /^\d{4}/.test(text) && !text.includes(String(year));
    }).first();

    if (nextYearHeading.length > 0) {
      tablesToProcess = yearHeading.nextUntil(nextYearHeading).filter('table.wikitable');
    } else {
      tablesToProcess = yearHeading.nextAll('table.wikitable');
    }
    console.log(`Found ${tablesToProcess.length} table(s) under "${year}" heading for year ${year}`);
  } else {
    // Fallback: try to find table by year in content
    const allTables = $('table.wikitable');
    tablesToProcess = allTables.filter((_, table) => {
      const tableText = $(table).text();
      return tableText.includes(String(year));
    });
    
    if (tablesToProcess.length === 0) {
      tablesToProcess = allTables;
    }
    console.log(`Found ${tablesToProcess.length} table(s) for year ${year} (fallback method)`);
  }
  
  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', year.toString(), 'stars-stripes');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process each table
  for (let tableIndex = 0; tableIndex < tablesToProcess.length; tableIndex++) {
    const table = $(tablesToProcess[tableIndex]);
    
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
      
      // Extract toy number from cell1 (e.g., "HRW62")
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
          year: year,
          model: {
            collection: {
              name: 'Stars & Stripes',
              year: {
                year: year,
              },
            },
          },
        },
        include: {
          images: true,
        },
      });

      if (!variant) {
        console.warn(`Variant not found for Toy# "${toyNumber}" (${castingName}, Year: ${year}); skipping.`);
        skippedCount++;
        continue;
      }

      // Get image types for this year
      const imageTypes = getImageTypesForYear(year);
      
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
        let urlObj: URL;
        try {
          urlObj = new URL(fullImgUrl);
        } catch (err) {
          console.error(`Invalid URL: ${fullImgUrl}`);
          errorCount++;
          continue;
        }
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
        const relativePath = path.join('/images', 'hotwheels', year.toString(), 'stars-stripes', castingSlug, fileName)
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

  console.log(`\n=== Year ${year} completed ===`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Image records created: ${createdCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const yearsToProcess = args.length > 0 ? [parseInt(args[0], 10)] : YEARS;

    if (yearsToProcess.some(y => isNaN(y))) {
      console.error('Invalid year argument. Please provide a valid year (2016, 2018, 2020, 2022, 2024) or no argument for all years.');
      process.exit(1);
    }

    console.log(`Processing years: ${yearsToProcess.join(', ')}`);

    for (const year of yearsToProcess) {
      try {
        await processYear(year);
      } catch (error) {
        console.error(`\n❌ Error processing year ${year}:`, error instanceof Error ? error.message : error);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
        // Continue with next year instead of stopping
      }
    }

    console.log('\n=== Download completed ===');
  } catch (error) {
    console.error('\n❌ Fatal error in main:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
