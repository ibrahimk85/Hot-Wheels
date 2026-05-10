/**
 * Script to download images for '21 Pagani Huayra R - Spectraflame Blue Indigo variant
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_pagani_huayra_blue_indigo_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const RLC_URL = 'https://hotwheels.fandom.com/wiki/2024_HWC/RLC_Releases';
const TARGET_YEAR = 2024;
const COLLECTION_NAME = 'Red Line Club';
const CASTING_NAME = "'21 Pagani Huayra R";
const TARGET_COLOR = 'Spectraflame Blue Indigo';

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
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
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
  try {
    console.log(`Fetching ${COLLECTION_NAME} ${TARGET_YEAR} page for Blue Indigo images...`);
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

    const headerRow = table.find('thead tr, tbody tr').first();
    const headerCells = headerRow.find('th, td');
    
    const seriesColIdx = findColumnIndex(headerCells, ['series', 'sub-series', 'subseries']);
    const castingColIdx = findColumnIndex(headerCells, ['casting', 'casting name', 'model', 'car']);
    const colorColIdx = findColumnIndex(headerCells, ['color', 'paint', 'finish']);
    const photoCardedColIdx = findColumnIndex(headerCells, ['photo carded', 'carded', 'packed', 'box']);
    const photoLooseColIdx = findColumnIndex(headerCells, ['photo loose', 'loose']);

    console.log(`Column indices - Series: ${seriesColIdx}, Casting: ${castingColIdx}, Color: ${colorColIdx}, Photo Carded: ${photoCardedColIdx}, Photo Loose: ${photoLooseColIdx}`);

    if (castingColIdx === -1) {
      throw new Error('Could not find Casting Name column in table');
    }

    const tbodyRows = table.find('tbody tr');
    const yearFolder = TARGET_YEAR.toString();
    const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'rlc');
    await fs.promises.mkdir(baseDir, { recursive: true });

    // Get collection and model records
    const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
    if (!yearRecord) {
      throw new Error(`Year ${TARGET_YEAR} not found in database`);
    }

    const collectionRecord = await prisma.collection.findFirst({
      where: {
        name: COLLECTION_NAME,
        yearId: yearRecord.id,
      },
    });
    if (!collectionRecord) {
      throw new Error(`Collection ${COLLECTION_NAME} for year ${TARGET_YEAR} not found`);
    }

    const model = await prisma.model.findFirst({
      where: {
        castingName: CASTING_NAME,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      throw new Error(`Model "${CASTING_NAME}" not found in database`);
    }

    // Find Blue Indigo variant
    const variant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        year: TARGET_YEAR,
        color: {
          contains: 'Blue Indigo',
        },
      },
    });

    if (!variant) {
      throw new Error(`Blue Indigo variant not found in database`);
    }

    console.log(`Found variant: ID ${variant.id}, Color: ${variant.color}`);

    // Find the Blue Indigo row in wiki table
    let foundRow = false;
    for (let i = 0; i < tbodyRows.length; i++) {
      const row = tbodyRows[i];
      const cells = $(row).find('td, th');
      
      if (cells.length < 2) continue;
      
      const castingNameCell = castingColIdx >= 0 && cells.length > castingColIdx 
        ? $(cells[castingColIdx]) 
        : null;
      
      if (!castingNameCell || castingNameCell.length === 0) continue;
      
      const castingNameLink = castingNameCell.find('a').first();
      const castingName = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : castingNameCell.text().trim();
      
      if (!castingName || !castingName.includes("Pagani Huayra R")) continue;

      // Check color column
      const colorCell = colorColIdx >= 0 && cells.length > colorColIdx 
        ? $(cells[colorColIdx]).text().trim()
        : '';
      
      // Check if this is the Blue Indigo variant
      if (colorCell.toLowerCase().includes('blue indigo') || colorCell.toLowerCase().includes('indigo')) {
        foundRow = true;
        console.log(`\nFound Blue Indigo row in wiki:`);
        console.log(`  Casting: ${castingName}`);
        console.log(`  Color: ${colorCell}`);

        const castingSlug = slugify(castingName);
        const targetFolder = path.join(baseDir, castingSlug);
        await fs.promises.mkdir(targetFolder, { recursive: true });

        // Process Photo Carded (main image) - Blue Indigo specific
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
              const fileName = `carded-blue-indigo.${ext}`;
              const destPath = path.join(targetFolder, fileName);
              const relativePath = `/images/hotwheels/${yearFolder}/rlc/${castingSlug}/${fileName}`;

              // Check if image already exists
              const existingImage = await prisma.image.findFirst({
                where: {
                  variantId: variant.id,
                  path: relativePath,
                },
              });

              if (!existingImage) {
                if (!fs.existsSync(destPath)) {
                  try {
                    await downloadImage(photoCardedUrl, destPath);
                    console.log(`  ✅ Downloaded Photo Carded: ${fileName}`);
                  } catch (err) {
                    console.error(`  ❌ Error downloading Photo Carded:`, err);
                  }
                } else {
                  console.log(`  ℹ️  Photo Carded already exists: ${fileName}`);
                }

                try {
                  const imageRecord = await prisma.image.create({
                    data: {
                      path: relativePath,
                      alt: `${castingName} - ${TARGET_COLOR} - Photo Carded`,
                      variant: { connect: { id: variant.id } },
                    },
                  });
                  console.log(`  ✅ Created image record for variant: ${imageRecord.id}`);
                } catch (err: any) {
                  if (err.code !== 'P2002') {
                    console.error(`  ❌ Error creating image record:`, err);
                  } else {
                    console.log(`  ℹ️  Image record already exists`);
                  }
                }
              } else {
                console.log(`  ℹ️  Image already associated with variant`);
              }
            }
          }
        }

        // Process Photo Loose (variant images) - Blue Indigo specific
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
                const fileName = `loose-blue-indigo-${idx + 1}.${ext}`;
                const destPath = path.join(targetFolder, fileName);
                const relativePath = `/images/hotwheels/${yearFolder}/rlc/${castingSlug}/${fileName}`;

                const existingImage = await prisma.image.findFirst({
                  where: {
                    variantId: variant.id,
                    path: relativePath,
                  },
                });

                if (!existingImage) {
                  if (!fs.existsSync(destPath)) {
                    try {
                      await downloadImage(photoLooseUrl, destPath);
                      console.log(`  ✅ Downloaded Photo Loose ${idx + 1}: ${fileName}`);
                    } catch (err) {
                      console.error(`  ❌ Error downloading Photo Loose ${idx + 1}:`, err);
                    }
                  } else {
                    console.log(`  ℹ️  Photo Loose ${idx + 1} already exists: ${fileName}`);
                  }

                  try {
                    await prisma.image.create({
                      data: {
                        path: relativePath,
                        alt: `${castingName} - ${TARGET_COLOR} - Photo Loose ${idx + 1}`,
                        variant: { connect: { id: variant.id } },
                      },
                    });
                    console.log(`  ✅ Created image record for Photo Loose ${idx + 1}`);
                  } catch (err: any) {
                    if (err.code !== 'P2002') {
                      console.error(`  ❌ Error creating Photo Loose image record:`, err);
                    } else {
                      console.log(`  ℹ️  Photo Loose ${idx + 1} image record already exists`);
                    }
                  }
                } else {
                  console.log(`  ℹ️  Photo Loose ${idx + 1} already associated with variant`);
                }
              }
            }
          }
        }

        break; // Found the row, exit loop
      }
    }

    if (!foundRow) {
      console.log(`\n⚠️  Warning: Could not find Blue Indigo row in wiki table`);
      console.log(`   Make sure the color column contains "Blue Indigo" or "Indigo"`);
    }

    console.log(`\n✅ Image download complete for ${CASTING_NAME} - ${TARGET_COLOR}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();







