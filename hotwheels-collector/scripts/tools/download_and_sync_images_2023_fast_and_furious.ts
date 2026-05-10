/**
 * Script to download image assets for the 2023 Hot Wheels Fast & Furious Series.
 * 
 * This script:
 *   1. Fetches the Fast & Furious Series page from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded/Photo Boxed and Photo Loose image URLs for 2023 year table
 *   3. Downloads images to public/images/hotwheels/2023/fast-and-furious/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Fast & Furious Series-specific:
 * - Photo Carded/Photo Boxed → Main image (variant.imageId)
 * - Photo Loose → Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - Variant matching: Year + Series # (Col #) + Casting Name + Color + SubSeries
 * - Supports Series 1, 2, 3 and 10-Pack tables
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2023_fast_and_furious.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2023;
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

/**
 * Extract sub-series name from table context (heading before table)
 */
function extractSubSeriesName($: cheerio.CheerioAPI, table: any): string {
  let subSeriesName = '';
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    if (!/^(contents|references|see also|external links|categories)$/i.test(headingText)) {
      subSeriesName = headingText.replace(/\[\]$/, '');
    }
  }
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption.replace(/\[\]$/, '');
    }
  }
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText.replace(/\[\]$/, '');
      }
    }
  }
  return subSeriesName || 'Unknown Series';
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
  
  // Find all tables - since we're on year-specific page, all tables belong to this year
  const allTables = $('table.wikitable');
  console.log(`Found ${allTables.length} table(s) for ${targetYear}. Processing…`);

  if (allTables.length === 0) {
    throw new Error(`Could not locate any tables for ${targetYear} on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'fast-and-furious');
  await fs.promises.mkdir(baseDir, { recursive: true });
  console.log(`Base directory: ${baseDir}`);

  let downloadCount = 0;
  let associatedCount = 0;

  // Process each table (Series 1, Series 2, Series 3, 10-Pack)
  for (let tableIdx = 0; tableIdx < allTables.length; tableIdx++) {
    const table = allTables[tableIdx];
    const currentSubSeriesName = extractSubSeriesName($, table);
    
    // Skip tables with generic or invalid names
    if (/^(contents|references|see also|external links|categories)$/i.test(currentSubSeriesName)) {
      console.log(`Skipping table with name: ${currentSubSeriesName}`);
      continue;
    }
    
    const is10Pack = currentSubSeriesName.toLowerCase().includes('10-pack') || 
                     currentSubSeriesName.toLowerCase().includes('10-car') ||
                     currentSubSeriesName.toLowerCase().includes('pack');
    
    console.log(`\nProcessing ${currentSubSeriesName}…`);
    
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Found ${rows.length} rows`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      let toyNumber: string | undefined;
      let collectorNumber: string | undefined;
      let castingNameLink: cheerio.Cheerio<any>;
      let color: string;
      let photoLooseColIdx: number;
      let photoCardedColIdx: number;

      if (is10Pack) {
        // 10-Pack table structure:
        // Column 0: Toy # (may be missing in some rows)
        // Column 1: Model Name (Casting Name) (link)
        // Column 2: Body Color
        // Column 3: Wheel Type
        // Column 4: Notes
        // Column 5: Photo Loose
        // Column 6: Photo Boxed (main image)
        const toyNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
        // Check if first cell is actually a toy number (like HNT21) or casting name
        if (/^[A-Z]{2,3}\d{2,3}$/.test(toyNumberRaw)) {
          toyNumber = toyNumberRaw;
          castingNameLink = $(cells[1]).find('a').first();
          color = cells.length > 2 ? $(cells[2]).text().trim() : '';
        } else {
          // First cell is casting name, not toy number
          toyNumber = undefined;
          castingNameLink = $(cells[0]).find('a').first();
          color = cells.length > 1 ? $(cells[1]).text().trim() : '';
        }
        collectorNumber = undefined; // 10-Pack doesn't have Col #
        photoLooseColIdx = 5; // Column 5: Photo Loose
        photoCardedColIdx = 6; // Column 6: Photo Boxed (main image)
      } else {
        // Series 1, 2, 3 table structure:
        // Column 0: Col # (Series #) - e.g., "1/10"
        // Column 1: Toy #
        // Column 2: Casting Name (link)
        // Column 3: Color
        // Column 4: Tampo
        // Column 5: Wheel Type
        // Column 6: Film Represented
        // Column 7: Notes
        // Column 8: Photo Loose
        // Column 9: Photo Carded (main image)
        const collectorNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
        // Parse series number from "1/10" format to just "1"
        if (collectorNumberRaw.includes('/')) {
          collectorNumber = collectorNumberRaw.split('/')[0].trim();
        } else {
          collectorNumber = collectorNumberRaw;
        }
        toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
        castingNameLink = $(cells[2]).find('a').first();
        color = cells.length > 3 ? $(cells[3]).text().trim() : '';
        photoLooseColIdx = 8; // Column 8: Photo Loose
        photoCardedColIdx = 9; // Column 9: Photo Carded (main image)
      }
      
      // Get casting name - prefer link text, fallback to cell text
      let castingNameRaw = '';
      if (castingNameLink.length > 0) {
        castingNameRaw = castingNameLink.text().trim();
      } else {
        // If no link, get cell text
        const cellText = is10Pack 
          ? (toyNumber ? $(cells[1]).text().trim() : $(cells[0]).text().trim())
          : $(cells[2]).text().trim();
        // Skip toy number patterns like HNR91, HNT01, etc.
        if (!/^[A-Z]{2,3}\d{2,3}$/.test(cellText)) {
          castingNameRaw = cellText;
        }
      }

      if (!castingNameRaw) {
        console.warn(`  Warning: Casting name not found for ${currentSubSeriesName} row ${i + 1}`);
        continue;
      }

      const castingName = castingNameRaw;

      // Find model using nested query with sub-series name
      const model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeries: {
            name: currentSubSeriesName,
            collection: {
              name: 'Fast & Furious',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${currentSubSeriesName})`);
        continue;
      }

      // Build variant search query - match import script logic exactly
      const variantWhere: any = {
        modelId: model.id,
        year: targetYear,
        releaseName: currentSubSeriesName,
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
        console.warn(`Variant not found: ${castingName} #${collectorNumber || 'N/A'} Color: ${color || 'N/A'} SubSeries: ${currentSubSeriesName}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Sanitize toyNumber for file names
      const sanitizedToyNumber = toyNumber && toyNumber.trim() !== '' 
        ? toyNumber.replace(/[\/\\<>:"|?*]/g, '_')
        : undefined;

      // Process Photo Carded/Photo Boxed (main image) - Column 9 for Series 1/2/3, Column 6 for 10-Pack
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
          
          // File name: {toyNumber}_carded.jpg or {toyNumber}_boxed.jpg
          let fileName: string;
          if (sanitizedToyNumber) {
            fileName = is10Pack 
              ? `${sanitizedToyNumber}_boxed.${ext}`
              : `${sanitizedToyNumber}_carded.${ext}`;
          } else {
            // For 10-Pack without toy number, use casting name slug
            fileName = is10Pack
              ? `${castingSlug}_boxed.${ext}`
              : `${castingSlug}_carded.${ext}`;
          }
          const destPath = path.join(targetFolder, fileName);

          // Download if not exists
          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(fullPhotoCardedUrl, destPath);
              downloadCount++;
              console.log(`Downloaded ${is10Pack ? 'Photo Boxed' : 'Photo Carded'}: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading ${is10Pack ? 'Photo Boxed' : 'Photo Carded'} for ${castingName}:`, err);
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
                    alt: `${castingName} (${is10Pack ? 'Boxed' : 'Carded'})`,
                    variant: { connect: { id: variant.id } },
                  },
                });
              }

              // Update variant.imageId to point to carded/boxed image
              await prisma.variant.update({
                where: { id: variant.id },
                data: { imageId: imageRecord.id },
              });
              associatedCount++;
              console.log(`Associated ${is10Pack ? 'Photo Boxed' : 'Photo Carded'} with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating ${is10Pack ? 'Photo Boxed' : 'Photo Carded'}:`, err);
            }
          }
        }
      }

      // Process Photo Loose (second image) - Column 8 for Series 1/2/3, Column 5 for 10-Pack
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
            // For 10-Pack without toy number, use casting name slug
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
