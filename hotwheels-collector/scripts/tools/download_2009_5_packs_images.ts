/**
 * Script to download images for 2009 Hot Wheels 5-Packs from the Fandom wiki.
 * 
 * This script:
 *   1. Fetches the 2009 5-Packs page
 *   2. Extracts Package# and Name from the table (no Year column in 2009)
 *   3. Downloads images from Column 4 (Photo)
 *   4. Saves images locally and creates Image records in the database
 * 
 * Table structure for 2009:
 * Column 0: Package#
 * Column 1: Name
 * Column 2: Vehicles
 * Column 3: Notes
 * Column 4: Photo (main image)
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_2009_5_packs_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const targetYear = 2009;

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

async function main() {
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
  let table = $('table.wikitable').first();
  if (!table || table.length === 0) {
    table = $('table').first();
  }
  if (!table || table.length === 0) {
    console.error(`Could not find the 5-Packs table on ${WIKI_URL}`);
    return;
  }

  // Create base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), '5-packs');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Get all rows from tbody
  // For 2009, we need at least Package#, Name, Vehicles (3 columns minimum)
  const rows = table.find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3; // At least Package#, Name, Vehicles
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

    // Extract data from columns (0-based index) for 2009
    // Column 0: Package#
    const packageNumberCell = $(cells[0]).text().trim();
    const packageNumber = extractFirstPackageNumber(packageNumberCell);
    
    // Column 1: Name (5-Pack name)
    const nameCell = $(cells[1]);
    const nameLink = nameCell.find('a').first();
    const name = nameLink.length > 0 ? nameLink.text().trim() : nameCell.text().trim();
    
    // Column 4: Photo (main image) - this is Column 5 in description but 0-based index is 4
    if (cells.length <= 4) {
      console.warn(`Skipping row ${i + 1}: no photo column (Package#: ${packageNumber})`);
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

    // Convert relative URL to absolute if needed
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/')) {
      imgUrl = 'https://hotwheels.fandom.com' + imgUrl;
    }

    // Remove query parameters and get clean URL
    try {
      const urlObj = new URL(imgUrl);
      // For Fandom images, use the revision URL without query params
      if (urlObj.pathname.includes('/revision/')) {
        imgUrl = urlObj.origin + urlObj.pathname;
      }
    } catch (e) {
      // URL parsing failed, use as is
    }

    // Find Variant by Package# and Name
    const yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
    if (!yearRecord) {
      console.warn(`Year ${targetYear} not found in database. Skipping...`);
      continue;
    }

    const collectionRecord = await prisma.collection.findFirst({
      where: {
        name: 'Hot Wheels 5-Packs',
        yearId: yearRecord.id,
      },
    });

    if (!collectionRecord) {
      console.warn(`Collection not found for year ${targetYear}. Skipping...`);
      continue;
    }

    const model = await prisma.model.findFirst({
      where: {
        castingName: name,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      console.warn(`Model not found: ${name} (Package#: ${packageNumber})`);
      skippedCount++;
      continue;
    }

    const variant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        cardNumber: packageNumber,
        year: targetYear,
      },
    });

    if (!variant) {
      console.warn(`Variant not found: ${name} (Package#: ${packageNumber})`);
      skippedCount++;
      continue;
    }

    // Check if image already exists
    const existingImage = await prisma.image.findFirst({
      where: {
        variantId: variant.id,
        alt: { contains: 'main' },
      },
    });

    if (existingImage) {
      console.log(`Image already exists for ${name} (Package#: ${packageNumber}); skipping.`);
      skippedCount++;
      continue;
    }

    // Download image
    try {
      const fileExtension = path.extname(new URL(imgUrl).pathname) || '.jpg';
      const fileName = `${packageNumber}_main${fileExtension}`;
      const filePath = path.join(baseDir, fileName);

      await downloadImage(imgUrl, filePath);
      downloadCount++;

      // Create relative path for database
      const relativePath = `images/hotwheels/${targetYear}/5-packs/${fileName}`;

      // Create Image record
      const imageRecord = await prisma.image.create({
        data: {
          path: relativePath,
          alt: `${name} (Package#: ${packageNumber}) - Main Image`,
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
      console.log(`Downloaded image for ${name} (Package#: ${packageNumber}) → ${fileName}`);
      console.log(`Created image record for ${name} (Package#: ${packageNumber}) [MAIN]`);

      // Small delay between downloads
      await sleep(500);
    } catch (error) {
      errorCount++;
      console.error(`Error downloading image for ${name} (Package#: ${packageNumber}):`, error);
    }
  }

  console.log(`\n=== Year ${targetYear} Download completed ===`);
  console.log(`  - Images downloaded: ${downloadCount}`);
  console.log(`  - Image records created: ${createdCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
