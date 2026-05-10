/**
 * Script to download images for TH, STH, and additional tables from 2017 Hot Wheels wiki.
 * Images are saved with Toy# as filename and matched to variants by Toy#.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, FANDOM_IMAGE_HEADERS } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/List_of_2017_Hot_Wheels';

interface TableInfo {
  heading: string;
  table: any;
  subSeriesName: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: FANDOM_IMAGE_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  
  const buffer = Buffer.from(await res.arrayBuffer());
  
  // Verify the buffer is not empty and has reasonable size
  if (buffer.length === 0) {
    throw new Error(`Downloaded image is empty: ${url}`);
  }
  
  // Verify it's a valid image by checking magic bytes
  const isValidImage = (buffer[0] === 0xFF && buffer[1] === 0xD8) || // JPEG
                       (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) || // PNG
                       (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46); // GIF
  
  // Only throw error if file is very small (likely placeholder) - otherwise accept it
  if (!isValidImage && buffer.length < 1000) {
    throw new Error(`Downloaded file does not appear to be a valid image: ${url} (size: ${buffer.length} bytes, likely placeholder)`);
  }
  
  await fs.promises.writeFile(dest, buffer);
}

async function main() {
  console.log('Fetching 2017 Hot Wheels wiki page...');
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  // Find 2017 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2017,
      },
    },
  });

  if (!mainlineCollection) {
    throw new Error('2017 Mainline collection not found. Please import data first.');
  }

  // Find all headings (h2, h3)
  const headings = $('h2, h3');
  const tablesToProcess: TableInfo[] = [];
  let foundTH = false;
  let foundSTH = false;

  // Find TH and STH tables, then all tables after them
  headings.each((index, heading) => {
    const headingText = $(heading).text().trim();
    
    // Check if this is TH or STH heading
    if (/Hot Wheels Treasure Hunt/i.test(headingText) && !/Super Treasure Hunt/i.test(headingText)) {
      foundTH = true;
      
      // Find the next table after this heading
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const subSeriesName = 'Treasure Hunt';
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: subSeriesName,
        });
      }
    }
    
    if (/Super Treasure Hunt/i.test(headingText)) {
      foundSTH = true;
      
      // Find the next table after this heading
      let nextElement = $(heading).next();
      while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
        nextElement = nextElement.next();
      }
      if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
        const subSeriesName = 'Super Treasure Hunt';
        tablesToProcess.push({
          heading: headingText,
          table: $(nextElement[0]),
          subSeriesName: subSeriesName,
        });
      }
    }
    
    // If we've found both TH and STH, start collecting all subsequent tables
    if (foundTH && foundSTH) {
      // Check if this heading comes after STH
      if (headingText && !/Super Treasure Hunt/i.test(headingText) && !/Hot Wheels Treasure Hunt/i.test(headingText)) {
        // Find the next table after this heading
        let nextElement = $(heading).next();
        while (nextElement.length > 0 && nextElement[0].tagName !== 'table') {
          nextElement = nextElement.next();
        }
        if (nextElement.length > 0 && nextElement[0].tagName === 'table') {
          // Use heading text as SubSeries name
          const subSeriesName = headingText.replace(/\[.*?\]/g, '').trim();
          tablesToProcess.push({
            heading: headingText,
            table: $(nextElement[0]),
            subSeriesName: subSeriesName,
          });
        }
      }
    }
  });

  console.log(`Found ${tablesToProcess.length} tables to process\n`);

  // Base directory for images
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2017', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  // Process each table
  for (const tableInfo of tablesToProcess) {
    const { subSeriesName, table } = tableInfo;
    console.log(`Processing table: ${subSeriesName}`);

    // Get table rows
    const rows = table.find('tbody tr');

    // Get headers to understand column structure
    const headerRow = table.find('thead tr, tbody tr').first();
    const headers = headerRow.find('th, td').map((i: number, el: any) => $(el).text().trim()).get();

    // Determine column indices
    let toyNumberIndex = 0;
    let modelNameIndex = 1;
    let imageIndex = -1;

    headers.forEach((header: string, index: number) => {
      if (/Toy#|Toy #/i.test(header)) toyNumberIndex = index;
      if (/Model|Name|Cast/i.test(header) && index > toyNumberIndex) modelNameIndex = index;
      if (/Image|Photo|Pic/i.test(header)) imageIndex = index;
    });

    // Find image column (usually the last column)
    if (imageIndex === -1) {
      // Try to find image in last column
      const firstRow = rows.first();
      if (firstRow.length > 0) {
        const cells = $(firstRow[0]).find('td');
        for (let i = cells.length - 1; i >= 0; i--) {
          const cellContent = $(cells[i]).html() || '';
          if (cellContent.includes('<img') || cellContent.includes('File:')) {
            imageIndex = i;
            break;
          }
        }
      }
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue; // Skip header rows

      const toyNumber = $(cells[toyNumberIndex] || cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue;

      // Get model name for folder structure (same as Mainline)
      const modelNameRaw = $(cells[modelNameIndex] || cells[1] || cells[0]).text().trim();
      let castingName = modelNameRaw;
      const variantMatch = modelNameRaw.match(/^(.*)\s+\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
      }

      // Build safe folder path for this casting (same as Mainline: use model name, not subseries)
      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Extract image URL - use Mainline script approach (simpler and works)
      let imageUrl = '';
      
      // Try to find img tag in the image column or last column
      let imgElement = null;
      if (imageIndex >= 0 && cells[imageIndex]) {
        imgElement = $(cells[imageIndex]).find('img').first();
      }
      
      // If not found, try last column
      if (!imgElement || imgElement.length === 0) {
        const lastCell = cells.last();
        imgElement = $(lastCell).find('img').first();
      }
      
      // Get URL from img tag (same as Mainline script)
      if (imgElement && imgElement.length > 0) {
        imageUrl = imgElement.attr('data-src') || imgElement.attr('src') || '';
      }
      
      // Ensure the URL is absolute (same as Mainline script)
      if (imageUrl) {
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        }
        
        // Derive the full-size image URL by removing thumbnail/scale modifiers
        // Fandom often appends paths like `/revision/latest/scale-to-width-down/250` or
        // `/thumbnail/width/250/height/250` to reduce image size. Remove these segments
        // to fetch the largest available version.
        imageUrl = imageUrl
          .replace(/\/scale-to-width-down\/\d+/g, '')
          .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
      }

      if (!imageUrl) {
        console.warn(`  ⚠️  No image found for ${castingName} (Toy#: ${toyNumber})`);
        continue;
      }

      // Download image
      const urlObj = new URL(imageUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${toyNumber}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      // Find variant by Toy# FIRST (before downloading)
      const variant = await prisma.variant.findFirst({
        where: {
          toyNumber: toyNumber,
          year: 2017,
          model: {
            collectionId: mainlineCollection.id,
          },
        },
        include: {
          model: true,
        },
      });

      if (!variant) {
        console.warn(`  ⚠️  Variant not found for ${castingName} (Toy#: ${toyNumber})`);
        continue;
      }

      // Check if variant already has a valid image
      let needsUpdate = true;
      if (variant.imageId !== null && variant.imageId !== undefined) {
        const existingImage = await prisma.image.findUnique({
          where: { id: variant.imageId },
        });
        if (existingImage) {
          // Check if file exists on disk
          const expectedPath = path.join(process.cwd(), 'public', existingImage.path);
          if (fs.existsSync(expectedPath)) {
            needsUpdate = false;
            // Skip - already has image and file exists
          } else {
            console.warn(`  ⚠️  Image record exists but file missing for ${castingName} (Toy#: ${toyNumber})`);
            needsUpdate = true;
          }
        } else {
          needsUpdate = true;
        }
      }

      // Download if not exists or file is empty/corrupted (less than 1KB)
      let downloaded = false;
      let shouldDownload = true;
      
      if (fs.existsSync(destPath)) {
        const stats = fs.statSync(destPath);
        // If file exists and has reasonable content (at least 1KB), skip download
        if (stats.size > 1024) {
          shouldDownload = false;
          console.log(`  ℹ️  File already exists: ${castingName} (Toy#: ${toyNumber}) [${stats.size} bytes]`);
        } else {
          // File exists but is too small (likely placeholder), delete it and re-download
          console.log(`  ⚠️  File exists but too small (${stats.size} bytes), re-downloading: ${castingName} (Toy#: ${toyNumber})`);
          fs.unlinkSync(destPath);
        }
      }
      
      if (shouldDownload) {
        try {
          console.log(`  📥 Downloading: ${castingName} (Toy#: ${toyNumber})...`);
          await downloadImage(imageUrl, destPath);
          
          // Verify file was written and has reasonable size
          if (fs.existsSync(destPath)) {
            const stats = fs.statSync(destPath);
            if (stats.size > 1024) {
              downloaded = true;
              downloadCount++;
              console.log(`  ✓ Downloaded: ${castingName} → ${fileName} [${stats.size} bytes]`);
            } else {
              // File is too small, likely a placeholder - delete it
              fs.unlinkSync(destPath);
              throw new Error(`Downloaded file is too small (${stats.size} bytes), likely a placeholder`);
            }
          } else {
            throw new Error('File was not created after download');
          }
        } catch (err) {
          console.error(`  ✗ Error downloading ${castingName} (Toy#: ${toyNumber}):`, err);
          console.error(`    URL: ${imageUrl.substring(0, 100)}...`);
          continue;
        }
      }

      // Create or update Image record (use castingSlug, not subSeriesSlug)
      const relativePath = path.join('/images', 'hotwheels', '2017', 'mainline', castingSlug, fileName).replace(/\\/g, '/');
      
      try {
        // Check if image record already exists for this variant
        let imageRecord = await prisma.image.findFirst({
          where: {
            variantId: variant.id,
            path: relativePath,
          },
        });

        if (!imageRecord) {
          // Create new Image record
          imageRecord = await prisma.image.create({
            data: {
              path: relativePath,
              alt: `${variant.model.castingName}${subSeriesName ? ` - ${subSeriesName}` : ''}`,
              modelId: variant.modelId,
              variantId: variant.id,
            },
          });
          console.log(`  ✓ Created image record for ${castingName} (Toy#: ${toyNumber})`);
        }

        // Update variant with imageId if not set or needs update
        if (needsUpdate && variant.imageId !== imageRecord.id) {
          await prisma.variant.update({
            where: { id: variant.id },
            data: { imageId: imageRecord.id },
          });
          associatedCount++;
          console.log(`  ✓ Associated: ${castingName} (Toy#: ${toyNumber}) → imageId: ${imageRecord.id}`);
        } else if (!needsUpdate) {
          console.log(`  ✓ Skipped (already has image): ${castingName} (Toy#: ${toyNumber})`);
        }
      } catch (err) {
        console.error(`  ✗ Error creating/updating image record for ${castingName}:`, err);
      }
    }
  }

  console.log(`\n✅ Download complete. ${downloadCount} images downloaded, ${associatedCount} variants updated.`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
