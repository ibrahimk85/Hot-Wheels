/**
 * Script to download and sync images for Red Line Club (RLC) 2025 collection
 * 
 * This script:
 * 1. Fetches the RLC 2025 wiki page
 * 2. Downloads Photo Carded images (main image) and Photo Loose images (variant images)
 * 3. Associates images with Model records in the database
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_and_sync_images_rlc_2025.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const RLC_URL = 'https://hotwheels.fandom.com/wiki/2025_HWC/RLC_Releases';
const TARGET_YEAR = 2025;
const COLLECTION_NAME = 'Red Line Club';

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
      imgUrl.includes('placeholder') ||
      imgUrl.includes('No_Image')) {
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

function findColumnIndex(headers: cheerio.Cheerio<any>, searchTerms: string[]): number {
  let index = -1;
  headers.each((idx, cell) => {
    const text = cheerio.load(cell).text().trim().toLowerCase();
    if (searchTerms.some(term => text.includes(term))) {
      index = idx;
      return false;
    }
  });
  return index;
}

async function main() {
  console.log(`Fetching ${COLLECTION_NAME} ${TARGET_YEAR} page for images...`);
  const response = await fetch(RLC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RLC_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const table = $('table.wikitable, table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the RLC table on the page');
  }

  // Find header row to determine column positions
  const headerRow = table.find('thead tr, tbody tr').first();
  const headerCells = headerRow.find('th, td');
  
  const seriesColIdx = findColumnIndex(headerCells, ['series', 'sub-series', 'subseries']);
  const castingColIdx = findColumnIndex(headerCells, ['casting', 'casting name', 'model', 'car']);
  const photoCardedColIdx = findColumnIndex(headerCells, ['photo carded', 'carded', 'packed', 'box']);
  const photoLooseColIdx = findColumnIndex(headerCells, ['photo loose', 'loose']);

  console.log(`Column indices - Series: ${seriesColIdx}, Casting: ${castingColIdx}, Photo Carded: ${photoCardedColIdx}, Photo Loose: ${photoLooseColIdx}`);

  if (castingColIdx === -1) {
    throw new Error('Could not find Casting Name column in table');
  }

  const tbodyRows = table.find('tbody tr');
  if (headerRow.parent().is('tbody')) {
    tbodyRows.slice(1);
  }

  const yearFolder = TARGET_YEAR.toString();
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'rlc');
  await fs.promises.mkdir(baseDir, { recursive: true });

  console.log(`\nProcessing ${tbodyRows.length} rows for image download...`);
  let downloadCount = 0;
  let associatedCount = 0;

  // Get collection record
  const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRecord) {
    throw new Error(`Year ${TARGET_YEAR} not found in database. Please run import script first.`);
  }

  const collectionRecord = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    throw new Error(`Collection ${COLLECTION_NAME} for year ${TARGET_YEAR} not found. Please run import script first.`);
  }

  for (let i = 0; i < tbodyRows.length; i++) {
    const row = tbodyRows[i];
    const cells = $(row).find('td, th');
    
    if (cells.length < 2) continue;
    
    const seriesName = seriesColIdx >= 0 && cells.length > seriesColIdx 
      ? $(cells[seriesColIdx]).text().trim() 
      : `${COLLECTION_NAME} ${TARGET_YEAR}`;
    
    const castingNameCell = castingColIdx >= 0 && cells.length > castingColIdx 
      ? $(cells[castingColIdx]) 
      : null;
    
    if (!castingNameCell || castingNameCell.length === 0) continue;
    
    const castingNameLink = castingNameCell.find('a').first();
    const castingName = castingNameLink.length > 0 
      ? castingNameLink.text().trim() 
      : castingNameCell.text().trim();
    
    if (!castingName || castingName.length === 0) continue;

    // Find model in database
    const model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        collectionId: collectionRecord.id,
        subSeries: {
          name: seriesName,
        },
      },
    });

    if (!model) {
      console.warn(`Model not found for ${castingName} (${seriesName}); skipping image association.`);
      continue;
    }

    const castingSlug = slugify(castingName);
    const targetFolder = path.join(baseDir, castingSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    // Process Photo Carded (main image)
    if (photoCardedColIdx >= 0 && cells.length > photoCardedColIdx) {
      const photoCardedCell = $(cells[photoCardedColIdx]);
      const photoCardedImg = photoCardedCell.find('img').first();
      let photoCardedUrl = photoCardedImg.length > 0 
        ? (photoCardedImg.attr('data-src') || photoCardedImg.attr('src') || null) 
        : null;
      
      if (photoCardedUrl) {
        photoCardedUrl = cleanImageUrl(photoCardedUrl);
        photoCardedUrl = checkImageNotAvailable(photoCardedUrl, castingName);
        
        if (photoCardedUrl) {
          const urlObj = new URL(photoCardedUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${yearFolder}/rlc/${castingSlug}/${fileName}`;

          const existingImage = await prisma.image.findFirst({
            where: {
              modelId: model.id,
              path: relativePath,
            },
          });

          if (!existingImage) {
            if (!fs.existsSync(destPath)) {
              try {
                await downloadImage(photoCardedUrl, destPath);
                downloadCount++;
                console.log(`  Downloaded Photo Carded: ${castingName} → ${fileName}`);
              } catch (err) {
                console.error(`  Error downloading Photo Carded for ${castingName}:`, err);
              }
            }

            try {
              const imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} - Photo Carded`,
                  model: { connect: { id: model.id } },
                },
              });
              
              if (!model.mainImageId) {
                await prisma.model.update({
                  where: { id: model.id },
                  data: { mainImageId: imageRecord.id },
                });
              }
              associatedCount++;
            } catch (err: any) {
              if (err.code !== 'P2002') {
                console.error(`  Error creating Photo Carded image record:`, err);
              }
            }
          }
        }
      }
    }

    // Process Photo Loose (variant images)
    if (photoLooseColIdx >= 0 && cells.length > photoLooseColIdx) {
      const photoLooseCell = $(cells[photoLooseColIdx]);
      const photoLooseImgs = photoLooseCell.find('img');
      
      for (let idx = 0; idx < photoLooseImgs.length; idx++) {
        const img = photoLooseImgs[idx];
        let photoLooseUrl = $(img).attr('data-src') || $(img).attr('src') || null;
        
        if (photoLooseUrl) {
          photoLooseUrl = cleanImageUrl(photoLooseUrl);
          photoLooseUrl = checkImageNotAvailable(photoLooseUrl, castingName);
          
          if (photoLooseUrl) {
            const urlObj = new URL(photoLooseUrl);
            const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const fileName = `loose-${idx + 1}.${ext}`;
            const destPath = path.join(targetFolder, fileName);
            const relativePath = `/images/hotwheels/${yearFolder}/rlc/${castingSlug}/${fileName}`;

            const existingImage = await prisma.image.findFirst({
              where: {
                modelId: model.id,
                path: relativePath,
              },
            });

            if (!existingImage) {
              if (!fs.existsSync(destPath)) {
                try {
                  await downloadImage(photoLooseUrl, destPath);
                  downloadCount++;
                  console.log(`  Downloaded Photo Loose ${idx + 1}: ${castingName} → ${fileName}`);
                } catch (err) {
                  console.error(`  Error downloading Photo Loose ${idx + 1} for ${castingName}:`, err);
                }
              }

              try {
                await prisma.image.create({
                  data: {
                    path: relativePath,
                    alt: `${castingName} - Photo Loose ${idx + 1}`,
                    model: { connect: { id: model.id } },
                  },
                });
                associatedCount++;
              } catch (err: any) {
                if (err.code !== 'P2002') {
                  console.error(`  Error creating Photo Loose image record:`, err);
                }
              }
            }
          }
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
  }

  console.log(`\nYear ${TARGET_YEAR} image download complete:`);
  console.log(`  Images downloaded: ${downloadCount}`);
  console.log(`  Images associated: ${associatedCount}`);
}

main()
  .catch((err) => {
    console.error('Error during image download:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

