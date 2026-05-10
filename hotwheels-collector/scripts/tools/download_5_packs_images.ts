/**
 * Script to download images for Hot Wheels 5-Packs variants.
 *
 * This script:
 *   1. Fetches the 5-Packs wiki page for the specified year(s)
 *   2. Parses the table to extract image URLs for each variant
 *   3. Downloads the main image (Photo column)
 *   4. Creates Image records in the database
 *   5. Sets the image as variant.imageId (main image)
 *
 * Table structure (0-based index):
 *   Column 0: Package# (can have multiple, use first one)
 *   Column 1: Year
 *   Column 2: Name (5-Pack name)
 *   Column 3: Vehicles (list of vehicles)
 *   Column 4: Notes (optional)
 *   Column 5: Photo (main image)
 *
 * How to use:
 *   # Download images for a specific year
 *   npx ts-node scripts/tools/download_5_packs_images.ts 2025
 *
 *   # Download images for multiple years (2020-2025)
 *   npx ts-node scripts/tools/download_5_packs_images.ts 2020 2021 2022 2023 2024 2025
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a name into a safe folder slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract first package number from a string that may contain multiple package numbers
 */
function extractFirstPackageNumber(packageNumberCell: string): string | null {
  if (!packageNumberCell) return null;
  
  // Split by whitespace and take the first one
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

async function processYear(targetYear: number) {
  const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_5-Packs`;
  console.log(`\n=== Processing ${targetYear} 5-Packs Images ===`);

  // Fetch page
  let html: string;
  try {
    html = await fetchWithRetry(WIKI_URL);
  } catch (error) {
    console.error(`Failed to fetch ${WIKI_URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  // Find the main table (first wikitable)
  const table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    console.error(`Could not find the 5-Packs table on ${WIKI_URL}`);
    return;
  }

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), '5-packs');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Get all rows from tbody
  const rows = table.find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 4; // At least Package#, Year, Name, Vehicles
  });

  console.log(`Found ${rows.length} rows. Processing…`);

  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    // Extract data from columns (0-based index)
    // Column 0: Package#
    const packageNumberCell = $(cells[0]).text().trim();
    const packageNumber = extractFirstPackageNumber(packageNumberCell);
    
    // Column 1: Year
    const yearCell = $(cells[1]).text().trim();
    const year = parseInt(yearCell, 10);
    
    // Column 2: Name (5-Pack name)
    const nameCell = $(cells[2]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 5: Photo (main image)
    if (cells.length <= 5) {
      console.warn(`Skipping row ${i + 1}: no photo column (Package#: ${packageNumber})`);
      skippedCount++;
      continue;
    }

    const photoCell = $(cells[5]);
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
      console.warn(`Skipping row ${i + 1}: no image found (Package#: ${packageNumber}, Name: ${name})`);
      skippedCount++;
      continue;
    }

    // Validate required fields
    if (!packageNumber || !name) {
      console.warn(`Skipping row ${i + 1}: missing required data (Package#: ${packageNumber}, Name: ${name})`);
      skippedCount++;
      continue;
    }

    // Validate year matches target year
    if (year !== targetYear) {
      console.warn(`Skipping row ${i + 1}: year mismatch (${year} != ${targetYear})`);
      skippedCount++;
      continue;
    }

    // Find variant by packageNumber and year
    const variant = await prisma.variant.findFirst({
      where: {
        cardNumber: packageNumber,
        year: targetYear,
        model: {
          collection: {
            name: 'Hot Wheels 5-Packs',
            year: {
              year: targetYear,
            },
          },
        },
      },
      include: {
        images: true,
      },
    });

    if (!variant) {
      console.warn(`Variant not found for Package# "${packageNumber}" (${name}, Year: ${targetYear}); skipping.`);
      skippedCount++;
      continue;
    }

    // Check if image already exists for this variant
    const existingImage = variant.images.find(
      img => img.order === 1 // Main image has order 1
    );

    if (existingImage) {
      console.log(`Image already exists for ${name} (Package#: ${packageNumber}); skipping.`);
      skippedCount++;
      continue;
    }

    // Clean and prepare image URL
    const fullImgUrl = cleanImageUrl(imgUrl);
    const altText = imgElement.attr('alt') || `${name} 5-Pack`;

    // Determine file extension
    const urlObj = new URL(fullImgUrl);
    const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'jpg';
    
    const modelSlug = slugify(name);
    const targetFolder = path.join(baseDir, modelSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });
    
    const fileName = `${packageNumber}_main.${ext}`;
    const destPath = path.join(targetFolder, fileName);

    // Download the image if not already downloaded
    if (!fs.existsSync(destPath)) {
      try {
        await downloadImage(fullImgUrl, destPath);
        downloadCount++;
        console.log(`Downloaded image for ${name} (Package#: ${packageNumber}) → ${fileName}`);
      } catch (err) {
        console.error(`Error downloading ${fullImgUrl}:`, err);
        errorCount++;
        continue;
      }
    } else {
      console.log(`Image already exists on disk: ${fileName}`);
    }

    // Create Image record
    const relativePath = path.join('/images', 'hotwheels', targetYear.toString(), '5-packs', modelSlug, fileName)
      .replace(/\\/g, '/');

    try {
      const imageRecord = await prisma.image.create({
        data: {
          path: relativePath,
          alt: altText,
          variant: { connect: { id: variant.id } },
          notes: 'main',
          order: 1,
        },
      });
      
      // Set as variant's main image
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: imageRecord.id },
      });
      
      createdCount++;
      console.log(`Created image record for ${name} (Package#: ${packageNumber}) [MAIN]`);
    } catch (err) {
      console.error(`Error creating image record for ${name} (Package#: ${packageNumber}):`, err);
      errorCount++;
    }

    // Small delay to avoid overwhelming the server
    if (i % 5 === 0) {
      await sleep(500);
    }
  }

  console.log(`\n=== Year ${targetYear} Download completed ===`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Image records created: ${createdCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Please provide at least one year as argument.');
    console.error('Usage: npx ts-node scripts/tools/download_5_packs_images.ts <year1> [year2] [year3] ...');
    console.error('Example: npx ts-node scripts/tools/download_5_packs_images.ts 2025');
    console.error('Example: npx ts-node scripts/tools/download_5_packs_images.ts 2020 2021 2022 2023 2024 2025');
    process.exit(1);
  }

  const years = args.map(arg => parseInt(arg, 10)).filter(year => !isNaN(year) && year >= 2000 && year <= 2100);
  
  if (years.length === 0) {
    console.error('No valid years provided. Please provide years between 2000 and 2100.');
    process.exit(1);
  }

  console.log(`Processing years: ${years.join(', ')}`);

  for (const year of years) {
    try {
      await processYear(year);
    } catch (error) {
      console.error(`Error processing year ${year}:`, error);
    }
  }

  console.log('\n=== All downloads completed ===');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
