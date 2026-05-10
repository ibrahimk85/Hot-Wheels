/**
 * Script to download Elite 64 2024 images only
 * 
 * This script:
 * 1. Reads existing Elite 64 2024 models from database
 * 2. Fetches the Elite 64 wiki page
 * 3. Downloads Photo Carded and Photo Loose images for each model
 * 4. Creates/updates Image records in database
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_elite64_images_2024.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const ELITE64_URL = 'https://hotwheels.fandom.com/wiki/Elite_64';
const TARGET_YEAR = 2024;
const YEAR_SEARCH_TEXT = '2024';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function checkImageNotAvailable(imgUrl: string | null, castingName: string): string | null {
  if (!imgUrl) return null;
  
  if (imgUrl.includes('Image_Not_Available') || 
      imgUrl.includes('Image%5FNot%5FAvailable') ||
      imgUrl.includes('placeholder')) {
    console.log(`  No Image available for ${castingName}`);
    return null;
  }
  return imgUrl;
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

function cleanImageUrl(imgUrl: string): string {
  if (imgUrl.startsWith('//')) {
    imgUrl = 'https:' + imgUrl;
  }
  
  let fullImgUrl = imgUrl
    .replace(/\/scale-to-width-down\/\d+/g, '')
    .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
    .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
  
  return fullImgUrl;
}

async function main() {
  console.log('=== Elite 64 2024 Image Download Script ===\n');

  // Get Elite 64 2024 collection
  const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRecord) {
    console.log(`Year ${TARGET_YEAR} not found. Please run import script first.`);
    return;
  }

  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Elite 64',
      yearId: yearRecord.id,
      isFuture: false,
    },
    include: {
      models: {
        include: {
          variants: true,
        },
      },
    },
  });

  if (!collection || collection.models.length === 0) {
    console.log(`No Elite 64 ${TARGET_YEAR} models found. Please run import script first.`);
    return;
  }

  console.log(`Found ${collection.models.length} models for Elite 64 ${TARGET_YEAR}\n`);

  // Fetch wiki page
  console.log('Fetching Elite 64 wiki page...');
  const response = await fetch(ELITE64_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ELITE64_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find 2024 header
  const allHeaders = $('h2');
  let yearHeader: any = null;
  
  allHeaders.each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes(YEAR_SEARCH_TEXT)) {
      yearHeader = el;
      return false;
    }
  });
  
  if (!yearHeader) {
    console.log(`Year ${TARGET_YEAR} section not found on wiki page`);
    return;
  }

  // Find table
  let table: cheerio.Cheerio<any> | null = null;
  let current: any = yearHeader;
  let depth = 0;
  const maxDepth = 50;
  
  while (depth < maxDepth && current) {
    current = current.nextSibling;
    if (!current) break;
    
    const $current = $(current);
    const tagName = current.tagName?.toLowerCase();
    
    if (tagName === 'h2' || tagName === 'h3') {
      break;
    }
    
    if (tagName === 'table') {
      table = $current;
      break;
    }
    
    const foundTable = $current.find('table').first();
    if (foundTable.length > 0) {
      table = foundTable;
      break;
    }
    
    depth++;
  }
  
  if (!table || table.length === 0) {
    console.log(`No table found for year ${TARGET_YEAR}`);
    return;
  }

  // Find column indices
  let photoCardedColIdx = 5;
  let photoLooseColIdx = 4;
  
  const headerRow = table.find('thead tr, tbody tr').first();
  if (headerRow.length > 0) {
    const headerCells = $(headerRow).find('th, td');
    headerCells.each((idx, cell) => {
      const headerText = $(cell).text().trim().toLowerCase();
      if (headerText.includes('photo carded') || headerText.includes('carded') || headerText.includes('packed')) {
        photoCardedColIdx = idx;
      }
      if (headerText.includes('photo loose') || headerText.includes('loose')) {
        photoLooseColIdx = idx;
      }
    });
  }

  const yearFolder = TARGET_YEAR.toString();
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'elite64');
  await fs.promises.mkdir(baseDir, { recursive: true });

  const tbodyRows = table.find('tbody tr');
  console.log(`Processing ${tbodyRows.length} rows from wiki...\n`);

  let imagesDownloaded = 0;
  let imagesCreated = 0;
  let imagesSkipped = 0;

  // Create a map of models by toyNumber and seriesNumber for quick lookup
  const modelMap = new Map<string, typeof collection.models[0]>();
  for (const model of collection.models) {
    const key = `${model.toyNumber || ''}-${model.seriesNumber || ''}`;
    modelMap.set(key, model);
  }

  for (let i = 0; i < tbodyRows.length; i++) {
    const row = tbodyRows[i];
    const cells = $(row).find('td');
    
    if (cells.length < 4) continue;

    const toyNumber = $(cells[0]).text().trim();
    const seriesNumber = $(cells[1]).text().trim();
    const castingNameCell = $(cells[2]);
    const castingNameLink = castingNameCell.find('a').first();
    const castingName = castingNameLink.length > 0 
      ? castingNameLink.text().trim() 
      : castingNameCell.text().trim();

    if (!toyNumber || !seriesNumber || !castingName) {
      continue;
    }

    // Find model in database
    const key = `${toyNumber}-${seriesNumber}`;
    const model = modelMap.get(key);
    
    if (!model) {
      console.log(`  Model not found in DB: ${castingName} (Toy#: ${toyNumber}, Series#: ${seriesNumber})`);
      continue;
    }

    // Get first variant (Elite 64 typically has one variant per model)
    const variant = model.variants[0];
    if (!variant) {
      console.log(`  No variant found for: ${castingName}`);
      continue;
    }

    console.log(`Processing: ${castingName} (Toy#: ${toyNumber}, Series#: ${seriesNumber})`);

    // Process Photo Carded (main image)
    const photoCardedCell = cells.length > photoCardedColIdx ? $(cells[photoCardedColIdx]) : null;
    const photoCardedImg = photoCardedCell ? photoCardedCell.find('img').first() : null;
    let photoCardedUrl = photoCardedImg ? (photoCardedImg.attr('data-src') || photoCardedImg.attr('src') || null) : null;
    
    if (photoCardedUrl) {
      photoCardedUrl = cleanImageUrl(photoCardedUrl);
      photoCardedUrl = checkImageNotAvailable(photoCardedUrl, castingName);
      
      if (photoCardedUrl) {
        const castingSlug = slugify(castingName);
        const targetFolder = path.join(baseDir, castingSlug);
        await fs.promises.mkdir(targetFolder, { recursive: true });

        const urlObj = new (globalThis.URL || require('url').URL)(photoCardedUrl);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `carded-${toyNumber}-${seriesNumber}.${ext}`;
        const destPath = path.join(targetFolder, fileName);
        const relativePath = `/images/hotwheels/${yearFolder}/elite64/${castingSlug}/${fileName}`;

        // Check if image already exists
        const existingImage = await prisma.image.findFirst({
          where: {
            modelId: model.id,
            path: relativePath,
          },
        });

        if (!existingImage) {
          // Download image
          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(photoCardedUrl, destPath);
              imagesDownloaded++;
              console.log(`  ✓ Downloaded Photo Carded: ${fileName}`);
            } catch (err) {
              console.error(`  ✗ Error downloading Photo Carded:`, err);
            }
          } else {
            imagesSkipped++;
            console.log(`  - Photo Carded already exists: ${fileName}`);
          }

          // Create image record
          try {
            const imageRecord = await prisma.image.create({
              data: {
                path: relativePath,
                alt: `${castingName} - Photo Carded`,
                model: { connect: { id: model.id } },
              },
            });
            
            // Set as main image if not already set
            if (!model.mainImageId) {
              await prisma.model.update({
                where: { id: model.id },
                data: { mainImageId: imageRecord.id },
              });
            }
            imagesCreated++;
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error(`  ✗ Error creating Photo Carded image record:`, err);
            }
          }
        } else {
          imagesSkipped++;
          console.log(`  - Photo Carded already in DB: ${fileName}`);
        }
      }
    }

    // Process Photo Loose (variant image)
    const photoLooseCell = cells.length > photoLooseColIdx ? $(cells[photoLooseColIdx]) : null;
    const photoLooseImg = photoLooseCell ? photoLooseCell.find('img').first() : null;
    let photoLooseUrl = photoLooseImg ? (photoLooseImg.attr('data-src') || photoLooseImg.attr('src') || null) : null;
    
    if (photoLooseUrl) {
      photoLooseUrl = cleanImageUrl(photoLooseUrl);
      photoLooseUrl = checkImageNotAvailable(photoLooseUrl, castingName);
      
      if (photoLooseUrl) {
        const castingSlug = slugify(castingName);
        const targetFolder = path.join(baseDir, castingSlug);
        await fs.promises.mkdir(targetFolder, { recursive: true });

        const urlObj = new (globalThis.URL || require('url').URL)(photoLooseUrl);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `loose-${toyNumber}-${seriesNumber}.${ext}`;
        const destPath = path.join(targetFolder, fileName);
        const relativePath = `/images/hotwheels/${yearFolder}/elite64/${castingSlug}/${fileName}`;

        // Check if image already exists
        const existingImage = await prisma.image.findFirst({
          where: {
            variantId: variant.id,
            path: relativePath,
          },
        });

        if (!existingImage) {
          // Download image
          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(photoLooseUrl, destPath);
              imagesDownloaded++;
              console.log(`  ✓ Downloaded Photo Loose: ${fileName}`);
            } catch (err) {
              console.error(`  ✗ Error downloading Photo Loose:`, err);
            }
          } else {
            imagesSkipped++;
            console.log(`  - Photo Loose already exists: ${fileName}`);
          }

          // Create image record
          try {
            await prisma.image.create({
              data: {
                path: relativePath,
                alt: `${castingName} - Photo Loose`,
                variant: { connect: { id: variant.id } },
              },
            });
            imagesCreated++;
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error(`  ✗ Error creating Photo Loose image record:`, err);
            }
          }
        } else {
          imagesSkipped++;
          console.log(`  - Photo Loose already in DB: ${fileName}`);
        }
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n=== Download Summary ===`);
  console.log(`Images downloaded: ${imagesDownloaded}`);
  console.log(`Image records created: ${imagesCreated}`);
  console.log(`Images skipped (already exist): ${imagesSkipped}`);
  console.log('\nElite 64 2024 image download completed!');
}

main()
  .catch((err) => {
    console.error('Error during image download:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

