/**
 * Script to download images for Hot Wheels Themed Multipack from the Fandom wiki.
 * 
 * This script:
 *   1. Fetches the Themed Multipack page
 *   2. Processes tables for years 2022-2026 (each year has its own table section)
 *   3. Extracts Package# and Name from each table
 *   4. Downloads images from Column 4 (Photo)
 *   5. Saves images locally and creates Image records in the database
 * 
 * Table structure:
 * Column 0: Package#
 * Column 1: Name
 * Column 2: Vehicles
 * Column 3: Notes
 * Column 4: Photo (main image)
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_themed_multipack_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const TARGET_YEARS = [2022, 2023, 2024, 2025, 2026];
const COLLECTION_NAME = 'Hot Wheels Themed multipack';
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Themed_multipack';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract first package number from a string that may contain multiple package numbers
 */
function extractFirstPackageNumber(packageNumberCell: string): string | null {
  if (!packageNumberCell) return null;
  
  const parts = packageNumberCell.trim().split(/\s+/);
  if (parts.length > 0 && parts[0]) {
    return parts[0].trim();
  }
  
  return null;
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

async function fetchWithRetry(url: string, retries = 5): Promise<string> {
  let delay = 3000;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Check if we got a bot challenge page
      if (html.length < 1000 || html.includes('Client Challenge') || html.includes('Just a moment') || html.includes('Checking your browser')) {
        throw new Error('Received bot challenge page');
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

async function downloadImage(imageUrl: string, filePath: string): Promise<void> {
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  await fs.promises.writeFile(filePath, Buffer.from(buffer));
}

/**
 * Process a single year's images
 */
async function processYear(year: number, $: cheerio.CheerioAPI) {
  console.log(`\n=== Processing Year ${year} Images ===`);

  // Find the year heading (h2, h3, or h4)
  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(year)) && !text.includes(String(year - 1)) && !text.includes(String(year + 1));
  }).first();

  if (yearHeading.length === 0) {
    console.warn(`Could not find heading for year ${year}`);
    return { downloaded: 0, created: 0, skipped: 0, errors: 0 };
  }

  // Find the table after this heading, before the next year heading
  const nextYearHeading = yearHeading.nextAll('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return /^\d{4}/.test(text) && !text.includes(String(year));
  }).first();

  let table;
  if (nextYearHeading.length > 0) {
    // Find table between current year heading and next year heading
    table = yearHeading.nextUntil(nextYearHeading).filter('table.wikitable').first();
  } else {
    // Find first table after current year heading
    table = yearHeading.nextAll('table.wikitable').first();
  }

  if (!table || table.length === 0) {
    // Try alternative selector
    table = yearHeading.nextAll('table').first();
  }

  if (!table || table.length === 0) {
    console.warn(`Could not find table for year ${year}`);
    return { downloaded: 0, created: 0, skipped: 0, errors: 0 };
  }

  console.log(`Found table for year ${year}. Processing…`);

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', year.toString(), 'themed-multipack');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Get all rows from tbody
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3; // At least Package#, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows for year ${year}. Processing…`);

  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get Collection record for this year
  const yearRecord = await prisma.year.findFirst({ where: { year: year } });
  if (!yearRecord) {
    console.warn(`Year ${year} not found in database. Skipping...`);
    return { downloaded: 0, created: 0, skipped: 0, errors: 0 };
  }

  const collectionRecord = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });

  if (!collectionRecord) {
    console.warn(`Collection "${COLLECTION_NAME}" not found for year ${year}. Skipping...`);
    return { downloaded: 0, created: 0, skipped: 0, errors: 0 };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    // Extract data from columns (0-based index)
    // Column 0: Package#
    const packageNumberCell = $(cells[0]).text().trim();
    const packageNumber = extractFirstPackageNumber(packageNumberCell);
    
    // Column 1: Name (Multipack name)
    const nameCell = $(cells[1]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 4: Photo (main image)
    if (cells.length <= 4) {
      console.warn(`Skipping row ${i + 1} (Year ${year}): no photo column (Package#: ${packageNumber})`);
      skippedCount++;
      continue;
    }

    const photoCell = $(cells[4]);
    const imgElement = photoCell.find('img').first();
    let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');

    if (!imgUrl) {
      // Try to get from link if img doesn't have src
      const linkElement = photoCell.find('a').first();
      if (linkElement.length > 0) {
        imgUrl = linkElement.attr('href');
      }
    }

    if (!imgUrl) {
      console.warn(`Skipping row ${i + 1} (Year ${year}): no image found (Package#: ${packageNumber}, Name: ${name})`);
      skippedCount++;
      continue;
    }

    // Validate required fields
    if (!packageNumber || !name) {
      console.warn(`Skipping row ${i + 1} (Year ${year}): missing required data (Package#: ${packageNumber}, Name: ${name})`);
      skippedCount++;
      continue;
    }

    // Clean and prepare image URL
    const fullImgUrl = cleanImageUrl(imgUrl);

    // Find Variant by Package# and year
    const model = await prisma.model.findFirst({
      where: {
        castingName: name,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      console.warn(`Model not found: ${name} (Package#: ${packageNumber}, Year: ${year})`);
      skippedCount++;
      continue;
    }

    const variant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: packageNumber,
        year: year,
      },
      include: {
        images: true,
      },
    });

    if (!variant) {
      console.warn(`Variant not found: ${name} (Package#: ${packageNumber}, Year: ${year})`);
      skippedCount++;
      continue;
    }

    // Check if image already exists
    const existingImage = variant.images.find(
      img => img.alt?.includes('Main') || img.alt?.includes('main')
    );

    if (existingImage) {
      console.log(`Image already exists for ${name} (Package#: ${packageNumber}, Year: ${year}); skipping.`);
      skippedCount++;
      continue;
    }

    // Download image
    try {
      // Determine file extension
      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${packageNumber}_main.${ext}`;
      const filePath = path.join(baseDir, fileName);

      // Download the image if not already downloaded
      if (!fs.existsSync(filePath)) {
        await downloadImage(fullImgUrl, filePath);
        downloadCount++;
        console.log(`Downloaded image for ${name} (Package#: ${packageNumber}, Year: ${year}) → ${fileName}`);
      } else {
        console.log(`Image already exists on disk: ${fileName}`);
      }

      // Create relative path for database
      const relativePath = `images/hotwheels/${year}/themed-multipack/${fileName}`;

      // Create Image record
      const imageRecord = await prisma.image.create({
        data: {
          path: relativePath,
          alt: `${name} (Package#: ${packageNumber}, Year: ${year}) - Main Image`,
          variant: { connect: { id: variant.id } },
          isGalleryImage: false, // Main image, not gallery
        },
      });

      // Update variant's imageId
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: imageRecord.id },
      });

      createdCount++;
      console.log(`Created image record for ${name} (Package#: ${packageNumber}, Year: ${year}) [MAIN]`);

      // Small delay between downloads
      await sleep(500);
    } catch (error) {
      errorCount++;
      console.error(`Error downloading image for ${name} (Package#: ${packageNumber}, Year: ${year}):`, error);
    }
  }

  console.log(`\n=== Year ${year} Download completed ===`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Image records created: ${createdCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);

  return { downloaded: downloadCount, created: createdCount, skipped: skippedCount, errors: errorCount };
}

async function main() {
  console.log(`\n=== Hot Wheels Themed Multipack Image Download ===`);
  console.log(`Fetching data from ${WIKI_URL}…`);

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(WIKI_URL);
  } catch (error) {
    console.error(`Failed to fetch ${WIKI_URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  let totalDownloaded = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each year
  for (const year of TARGET_YEARS) {
    const result = await processYear(year, $);
    totalDownloaded += result.downloaded;
    totalCreated += result.created;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  console.log(`\n=== All Years Download completed ===`);
  console.log(`  - Total Images downloaded: ${totalDownloaded}`);
  console.log(`  - Total Image records created: ${totalCreated}`);
  console.log(`  - Total Skipped: ${totalSkipped}`);
  console.log(`  - Total Errors: ${totalErrors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
