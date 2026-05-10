/**
 * Script to download images for Neon Speeders Series variants.
 *
 * This script:
 *   1. Fetches Neon Speeders Series wiki page for the specified year(s)
 *   2. Parses the table to extract image URLs for each variant
 *   3. Downloads 3 image types: loose, carded (main), blacklight
 *   4. Creates Image records in the database
 *   5. Sets carded image as variant.imageId (main image)
 *
 * Table structure (0-indexed):
 *   Column 0: Position (1/8, 2/8, etc.)
 *   Column 1: Card Number (JKX93, etc.)
 *   Column 2: Casting Name
 *   Column 3: Color
 *   Column 4: Base Code prefix (NS6)
 *   Column 5: Base Code (U31I, U32I, etc.)
 *   Column 6: Loose Image
 *   Column 7: Blacklight Image
 *   Column 8: Carded Image (main image)
 *
 * Image order:
 *   - Carded (order: 1) - main image (variant.imageId)
 *   - Loose (order: 2)
 *   - Blacklight (order: 3)
 *
 * How to use:
 *   # Download images for single year
 *   npx ts-node scripts/tools/download_neon_speeders_images.ts 2023
 *
 *   # Download images for all years (2023-2026)
 *   npx ts-node scripts/tools/download_neon_speeders_images.ts
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
const YEARS = [2023, 2024, 2025, 2026];

// Image types and their order
// Table structure for 2023-2025 (10 columns):
// Column 0: Series #, Column 1: Toy #, Column 2: Casting Name, Column 3: Color, 
// Column 4: Tamposh, Column 5: Wheel Type, Column 6: Notes,
// Column 7: Photo Loose, Column 8: Photo Blacklight, Column 9: Photo Carded
// Table structure for 2026 (9 columns, no Tamposh):
// Column 0: Series #, Column 1: Toy #, Column 2: Casting Name, Column 3: Color,
// Column 4: Wheel Type, Column 5: Notes,
// Column 6: Photo Loose, Column 7: Photo Blacklight, Column 8: Photo Carded
function getImageTypesForYear(year: number) {
  if (year === 2026) {
    // 2026 has 9 columns, images are at indices 6, 7, 8
    return [
      { type: 'carded', order: 1, columnIndex: 8, isMain: true },
      { type: 'loose', order: 2, columnIndex: 6, isMain: false },
      { type: 'blacklight', order: 3, columnIndex: 7, isMain: false },
    ] as const;
  } else {
    // 2023-2025 have 10 columns, images are at indices 7, 8, 9
    return [
      { type: 'carded', order: 1, columnIndex: 9, isMain: true },
      { type: 'loose', order: 2, columnIndex: 7, isMain: false },
      { type: 'blacklight', order: 3, columnIndex: 8, isMain: false },
    ] as const;
  }
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
      
      // Check if we got a bot challenge page
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page (HTML too short or contains "Client Challenge")');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms before retry…`);
        await sleep(delay);
        delay *= 1.5; // Exponential backoff
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

  // Delete existing images for this year's variants (to allow re-download)
  const variants = await prisma.variant.findMany({
    where: {
      year: year,
      model: {
        collection: {
          name: 'Neon Speeders',
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

  // Build wiki URL - all years are on the same page (2023 page)
  const wikiUrl = `https://hotwheels.fandom.com/wiki/Neon_Speeders_Series_(2023)`;

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(wikiUrl);
  } catch (error) {
    console.error(`Failed to fetch ${wikiUrl} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // For 2023, find the table under the "2023" heading
  // For 2024, find all tables under "2024" heading (Mix 1, Mix 2, etc.)
  let tablesToProcess;
  
  if (year === 2023) {
    const heading2023 = $('h2, h3, h4').filter((_, el) => {
      return $(el).text().trim().includes('2023');
    }).first();
    
    let targetTable;
    if (heading2023.length > 0) {
      targetTable = heading2023.nextUntil('h2, h3, h4').filter('table.wikitable').first();
      if (targetTable.length === 0) {
        targetTable = heading2023.next('table.wikitable').first();
      }
      console.log(`Found table under "2023" heading for year ${year}`);
    }
    
    if (!targetTable || targetTable.length === 0) {
      const allTables = $('table.wikitable');
      if (allTables.length === 0) {
        console.error(`Could not find any tables on ${wikiUrl}`);
        return;
      }
      targetTable = allTables.first();
      console.log(`Using first table (found ${allTables.length} table(s))`);
    }
    tablesToProcess = [targetTable];
  } else if (year === 2024 || year === 2025 || year === 2026) {
    // Find the year heading (2024 or 2025)
    const yearHeading = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return text.includes(String(year)) && !text.includes(String(year - 1));
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
      const allTables = $('table.wikitable');
      if (allTables.length === 0) {
        console.error(`Could not find any tables on ${wikiUrl}`);
        return;
      }
      tablesToProcess = allTables;
      console.log(`Using all tables (found ${allTables.length} table(s))`);
    }
  } else {
    const allTables = $('table.wikitable');
    if (allTables.length === 0) {
      console.error(`Could not find any tables on ${wikiUrl}`);
      return;
    }
    tablesToProcess = allTables;
    console.log(`Using all tables (found ${allTables.length} table(s))`);
  }

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', year.toString(), 'neon-speeders');
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
      return cells.length >= 4; // At least Card Number, Casting Name, Color, Base Code
    });

    console.log(`Processing ${rows.length} rows from table ${tableIndex + 1}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract card number and casting name
      // Table structure for 2023:
      // Column 0: Series #, Column 1: Toy # (Card Number), Column 2: Casting Name
      const cell0 = cells.length > 0 ? $(cells[0]).text().trim() : ''; // Series #
      const cell1 = cells.length > 1 ? $(cells[1]).text().trim() : ''; // Toy # / Card Number
      const cell2 = cells.length > 2 ? $(cells[2]).text().trim() : ''; // Casting Name

      // Card number is in cell1 (Toy # column)
      let cardNumber: string | null = null;
      let castingNameRaw: string = '';
      
      // Extract card number from cell1 (e.g., "HLH73")
      const cell1CardMatch = cell1.match(/^([A-Z]{3}\d{2,3})$/);
      if (cell1CardMatch) {
        cardNumber = cell1CardMatch[1];
        castingNameRaw = cell2; // Casting name is in column 2
      } else {
        // Try to extract from cell1 if it contains the pattern
        const cell1CardMatch2 = cell1.match(/([A-Z]{3}\d{2,3})/);
        if (cell1CardMatch2) {
          cardNumber = cell1CardMatch2[1];
          castingNameRaw = cell2;
        }
      }

      if (!cardNumber || !castingNameRaw) {
        console.warn(`Skipping row - cardNumber: "${cardNumber}", castingName: "${castingNameRaw}"`);
        skippedCount++;
        continue;
      }

      // Clean casting name (remove card number if present, remove parentheses)
      let castingName = castingNameRaw.replace(cardNumber, '').trim();
      if (castingName.includes('(') && castingName.includes(')')) {
        castingName = castingName.replace(/\([^)]*\)/g, '').trim();
      }
      castingName = castingName.replace(/\s+/g, ' ').trim();

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Find variant by cardNumber and year
      const variant = await prisma.variant.findFirst({
        where: {
          cardNumber: cardNumber,
          year: year,
          model: {
            collection: {
              name: 'Neon Speeders',
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
        console.warn(`Variant not found for Card# "${cardNumber}" (${castingName}, Year: ${year}); skipping.`);
        skippedCount++;
        continue;
      }

      // Get image types for this year (2026 has different column indices)
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
        const urlObj = new URL(fullImgUrl);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `${cardNumber}_${imageType.type}.${ext}`;
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
            console.log(`Downloaded ${imageType.type} image for ${castingName} (Card#: ${cardNumber}) → ${fileName}`);
          } catch (err) {
            console.error(`Error downloading ${fullImgUrl}:`, err);
            errorCount++;
            continue;
          }
        }

        // Create Image record
        const relativePath = path.join('/images', 'hotwheels', year.toString(), 'neon-speeders', castingSlug, fileName)
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
          console.log(`Created ${imageType.type} image record for ${castingName} (Card#: ${cardNumber})${imageType.isMain ? ' [MAIN]' : ''}`);
        } catch (err) {
          console.error(`Error creating ${imageType.type} image record for ${castingName} (Card#: ${cardNumber}):`, err);
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
  const args = process.argv.slice(2);
  const yearsToProcess = args.length > 0 ? [parseInt(args[0], 10)] : YEARS;

  if (yearsToProcess.some(y => isNaN(y))) {
    console.error('Invalid year argument. Please provide a valid year (2023-2026) or no argument for all years.');
    process.exit(1);
  }

  console.log(`Processing years: ${yearsToProcess.join(', ')}`);

  for (const year of yearsToProcess) {
    await processYear(year);
  }

  console.log('\n=== Download completed ===');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
