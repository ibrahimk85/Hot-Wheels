/**
 * Script to download image assets for the 2020 Hot Wheels Fast & Furious Series.
 * 
 * This script:
 *   1. Fetches the Fast & Furious Series page from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs for 2020 year table
 *   3. Downloads images to public/images/hotwheels/2020/fast-and-furious/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Fast & Furious Series-specific:
 * - Photo Carded → Main image (variant.imageId)
 * - Photo Loose → Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - Variant matching: Year + Series # + Casting Name + Color + SubSeries
 * 
 * 2020 Table Structure (9 columns):
 * - Column 0: Series # - e.g., "1/5"
 * - Column 1: Toy #
 * - Column 2: Casting Name (link)
 * - Column 3: Color
 * - Column 4: Tampos
 * - Column 5: Wheel Type
 * - Column 6: Notes
 * - Column 7: Photo - Car (Loose)
 * - Column 8: Photo - Card (Carded)
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2020_fast_and_furious.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const prisma = new PrismaClient();

// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to hotwheels-collector directory (go up from scripts/tools to hotwheels-collector)
const projectRoot = path.resolve(__dirname, '../..');

const targetYear = 2020;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/Fast_%26_Furious_Series_(${targetYear})`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  // Ensure directory exists before writing file
  const dir = path.dirname(dest);
  await fs.promises.mkdir(dir, { recursive: true });
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

async function main() {
  console.log('=== FAST & FURIOUS SERIES IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);
  
  console.log(`Fetching ${targetYear} Fast & Furious Series page…`);
  const resp = await fetch(WIKI_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);
  
  // Find the main table
  const table = $('table.wikitable').first();
  if (table.length === 0) {
    throw new Error(`Could not locate any tables for ${targetYear} on the page ${WIKI_URL}`);
  }

  // Use projectRoot to ensure we're in the hotwheels-collector directory
  const baseDir = path.join(projectRoot, 'public', 'images', 'hotwheels', targetYear.toString(), 'fast-and-furious');
  await fs.promises.mkdir(baseDir, { recursive: true });
  console.log(`Base directory: ${baseDir}`);

  let downloadCount = 0;
  let associatedCount = 0;

  const subSeriesName = targetYear.toString();
  
  const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
    const cells = $(row).find('td');
    return cells.length >= 3;
  });

  console.log(`Found ${rows.length} rows`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    if (cells.length === 0) continue;

    // 2020 table structure (9 columns):
    // Column 0: Series # - e.g., "1/5"
    // Column 1: Toy #
    // Column 2: Casting Name (link)
    // Column 3: Color
    // Column 4: Tampos
    // Column 5: Wheel Type
    // Column 6: Notes
    // Column 7: Photo - Car (Loose)
    // Column 8: Photo - Card (Carded)
    
    const collectorNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
    let collectorNumber: string | undefined;
    if (collectorNumberRaw.includes('/')) {
      collectorNumber = collectorNumberRaw.split('/')[0].trim();
    } else {
      collectorNumber = collectorNumberRaw || undefined;
    }
    
    const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const castingNameLink = $(cells[2]).find('a').first();
    const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
    
    // Get casting name
    let castingNameRaw = '';
    if (castingNameLink.length > 0) {
      castingNameRaw = castingNameLink.text().trim();
    } else {
      castingNameRaw = $(cells[2]).text().trim();
    }

    if (!castingNameRaw) {
      console.warn(`  Warning: Casting name not found for ${subSeriesName} row ${i + 1}`);
      continue;
    }

    const castingName = castingNameRaw;

    // Find model using nested query with sub-series name
    const model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        subSeries: {
          name: subSeriesName,
          collection: {
            name: 'Fast & Furious',
            year: { year: targetYear },
          },
        },
      },
    });

    if (!model) {
      console.warn(`Model not found: ${castingName} (${subSeriesName})`);
      continue;
    }

    // Build variant search query - match import script logic exactly
    const variantWhere: any = {
      modelId: model.id,
      year: targetYear,
      releaseName: subSeriesName,
    };
    
    // Match import script: collectorNumber || undefined
    if (collectorNumber) {
      variantWhere.cardNumber = collectorNumber;
    } else {
      variantWhere.cardNumber = null;
    }
    
    // Match import script: color || undefined
    if (color && color.trim() !== '') {
      variantWhere.color = color.trim();
    } else {
      variantWhere.color = null;
    }
    
    const variant = await prisma.variant.findFirst({
      where: variantWhere,
      include: {
        images: true,
      },
    });

    if (!variant) {
      console.warn(`Variant not found: ${castingName} #${collectorNumber || 'N/A'} Color: ${color || 'N/A'} SubSeries: ${subSeriesName}`);
      continue;
    }

    const castingSlug = slugify(castingName);
    const targetFolder = path.join(baseDir, castingSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    // Sanitize toyNumber for file names
    const sanitizedToyNumber = toyNumber && toyNumber.trim() !== '' 
      ? toyNumber.replace(/[\/\\<>:"|?*]/g, '_')
      : undefined;

    // Process Photo Carded (main image) - Column 8
    const photoCardedColIdx = 8;
    if (cells.length > photoCardedColIdx) {
      const photoCardedImgElement = $(cells[photoCardedColIdx]).find('img').first();
      const photoCardedImgUrlRaw = photoCardedImgElement.attr('data-src') || 
                                   photoCardedImgElement.attr('src') || 
                                   photoCardedImgElement.attr('data-original');
      
      if (photoCardedImgUrlRaw) {
        // Ensure the URL is absolute
        let photoCardedImgUrl = photoCardedImgUrlRaw;
        if (photoCardedImgUrl.startsWith('//')) {
          photoCardedImgUrl = 'https:' + photoCardedImgUrl;
        }
        // Derive the full‑size image URL by removing thumbnail/scale modifiers
        let fullPhotoCardedUrl = photoCardedImgUrl
          .replace(/\/scale-to-width-down\/\d+/g, '')
          .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
          .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');

        const urlObj = new URL(`${fullPhotoCardedUrl}`);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        
        // File name: {toyNumber}_carded.jpg
        let fileName: string;
        if (sanitizedToyNumber) {
          fileName = `${sanitizedToyNumber}_carded.${ext}`;
        } else {
          fileName = `${castingSlug}_carded.${ext}`;
        }
        const destPath = path.join(targetFolder, fileName);

        // Download if not exists
        if (!fs.existsSync(destPath)) {
          try {
            await downloadImage(fullPhotoCardedUrl, destPath);
            downloadCount++;
            console.log(`Downloaded Photo Carded: ${castingName} → ${fileName}`);
          } catch (err) {
            console.error(`Error downloading Photo Carded for ${castingName}:`, err);
          }
        }

        // Associate as main image (update even if variant already has one)
        if (fs.existsSync(destPath)) {
          const relativePath = `/images/hotwheels/${targetYear}/fast-and-furious/${castingSlug}/${fileName}`;
          try {
            // Check if image record already exists
            let imageRecord = await prisma.image.findFirst({
              where: {
                path: relativePath,
                variantId: variant.id,
              },
            });

            if (!imageRecord) {
              imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Carded)`,
                  variant: { connect: { id: variant.id } },
                },
              });
            }

            // Update variant.imageId to point to carded image
            await prisma.variant.update({
              where: { id: variant.id },
              data: { imageId: imageRecord.id },
            });
            associatedCount++;
            console.log(`Associated Photo Carded with variant ${castingName}`);
          } catch (err) {
            console.error(`Error associating Photo Carded:`, err);
          }
        }
      }
    }

    // Process Photo Loose (second image) - Column 7
    const photoLooseColIdx = 7;
    if (cells.length > photoLooseColIdx) {
      const photoLooseImgElement = $(cells[photoLooseColIdx]).find('img').first();
      const photoLooseImgUrlRaw = photoLooseImgElement.attr('data-src') || 
                                  photoLooseImgElement.attr('src') || 
                                  photoLooseImgElement.attr('data-original');
      
      if (photoLooseImgUrlRaw) {
        // Ensure the URL is absolute
        let photoLooseImgUrl = photoLooseImgUrlRaw;
        if (photoLooseImgUrl.startsWith('//')) {
          photoLooseImgUrl = 'https:' + photoLooseImgUrl;
        }
        // Derive the full‑size image URL by removing thumbnail/scale modifiers
        let fullPhotoLooseUrl = photoLooseImgUrl
          .replace(/\/scale-to-width-down\/\d+/g, '')
          .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
          .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');

        const urlObj = new URL(`${fullPhotoLooseUrl}`);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        
        // File name: {toyNumber}_loose.jpg
        let fileName: string;
        if (sanitizedToyNumber) {
          fileName = `${sanitizedToyNumber}_loose.${ext}`;
        } else {
          fileName = `${castingSlug}_loose.${ext}`;
        }
        const destPath = path.join(targetFolder, fileName);

        // Check if loose image already exists in database
        const existingLooseImage = await prisma.image.findFirst({
          where: {
            variantId: variant.id,
            path: {
              contains: sanitizedToyNumber ? `${sanitizedToyNumber}_loose` : `${castingSlug}_loose`,
            },
          },
        });

        // Download if not exists
        if (!fs.existsSync(destPath) && !existingLooseImage) {
          try {
            await downloadImage(fullPhotoLooseUrl, destPath);
            downloadCount++;
            console.log(`Downloaded Photo Loose: ${castingName} → ${fileName}`);
          } catch (err) {
            console.error(`Error downloading Photo Loose for ${castingName}:`, err);
          }
        }

        // Associate as second image if file exists and not already in DB
        if (!existingLooseImage) {
          const relativePath = `/images/hotwheels/${targetYear}/fast-and-furious/${castingSlug}/${fileName}`;
          
          // Check if file exists (either just downloaded or already exists)
          if (fs.existsSync(destPath)) {
            try {
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated Photo Loose with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating Photo Loose:`, err);
            }
          }
        } else {
          console.log(`Photo Loose already associated with variant ${castingName}`);
        }
      }
    }
  }

  console.log(`\nDownload complete. ${downloadCount} images downloaded, ${associatedCount} images associated.`);
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
