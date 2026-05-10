/**
 * Script to download image assets for the 2021 Hot Wheels Car Culture 2-Packs set and
 * associate them with Model and Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2021 Car Culture 2-Packs page from the Hot Wheels Fandom wiki and
 *      extracts image URLs from tables (Photo Carded and Photo Loose columns).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2021/car-culture-2-packs/` folder.
 *   2. Associates images with database records:
 *      - Photo Carded (Column 7) → Model's mainImageId (for the 2-Pack set)
 *      - Photo Loose (Column 6) → Variant's images (for each car casting's variant)
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2021 Car Culture 2-Packs variants using the import script.
 *   - The script matches images by Toy#, Theme, and Casting Name to find corresponding
 *     Models and Variants in the database.
 *   - Photo Carded images are set as the main image for the Model (2-Pack set).
 *   - Photo Loose images: Each casting has its own loose image in Column 6
 *   - The script skips downloading an image if the file already exists
 *     locally and skips creating Image records if they already exist.
 *   - Running this script multiple times is safe; it will only download
 *     missing images and create missing associations.
 *
 * Table columns (0-based index):
 * 0: Toy#
 * 1: Theme
 * 2: Casting Name
 * 3: Body Color
 * 4: Wheel Type
 * 5: Notes
 * 6: Photo Loose
 * 7: Photo Carded
 *
 * Usage:
 *   npx ts-node scripts/tools/download_and_sync_images_2021_car_culture_2_packs.ts
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const CAR_CULTURE_2_PACKS_URL = 'https://hotwheels.fandom.com/wiki/Car_Culture_2-Packs';
const targetYear = 2021;

// Column indices (0-based)
const COLUMN_TOY_NUMBER = 0;
const COLUMN_THEME = 1;
const COLUMN_CASTING_NAME = 2;
const COLUMN_BODY_COLOR = 3;
const COLUMN_WHEEL_TYPE = 4;
const COLUMN_NOTES = 5;
const COLUMN_PHOTO_LOOSE = 6;
const COLUMN_PHOTO_CARDED = 7;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
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

function extractYearFromHeading($: cheerio.CheerioAPI, table: any): number | null {
  // Look for headings before this table that contain year information
  const prevHeadings = $(table).prevAll('h2, h3, h4, span.mw-headline');
  for (let i = 0; i < prevHeadings.length && i < 10; i++) {
    const heading = prevHeadings.eq(i);
    const headingText = heading.text().trim();
    // Look for 4-digit year pattern (2021, 2022, etc.)
    const yearMatch = headingText.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10);
    }
  }
  return null;
}

function extractSubSeriesName($: cheerio.CheerioAPI, table: any): string {
  let subSeriesName = '';
  
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    if (!/^(contents|references|see also|external links|categories)$/i.test(headingText)) {
      subSeriesName = headingText;
    }
  }
  
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption;
    }
  }
  
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText;
      }
    }
  }
  
  // Try previous div with class containing "heading" or "title"
  if (!subSeriesName) {
    const prevDiv = $(table).prevAll('div[class*="heading"], div[class*="title"]').first();
    if (prevDiv.length > 0) {
      const divText = prevDiv.text().trim();
      if (divText && !/^(contents|references|see also|external links|categories)$/i.test(divText)) {
        subSeriesName = divText;
      }
    }
  }
  
  // Try previous strong or bold text
  if (!subSeriesName) {
    const prevStrong = $(table).prevAll('strong, b').first();
    if (prevStrong.length > 0) {
      const strongText = prevStrong.text().trim();
      if (strongText && strongText.length < 100 && !/^(contents|references|see also|external links|categories)$/i.test(strongText)) {
        subSeriesName = strongText;
      }
    }
  }
  
  // Clean up sub-series name: remove trailing [] if present
  const cleanedName = (subSeriesName || 'Unknown Series').replace(/\[\]$/, '');
  return cleanedName;
}

interface RowData {
  toyNumber: string;
  theme: string;
  castingName: string;
  photoCardedUrl: string | null;
  photoLooseUrl: string | null;
  rowIndex: number;
}

async function main() {
  console.log(`Fetching ${targetYear} Car Culture 2-Packs page…`);
  const resp = await fetch(CAR_CULTURE_2_PACKS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${CAR_CULTURE_2_PACKS_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s). Processing…`);

  if (tables.length === 0) {
    throw new Error(`Could not find any tables on the page ${CAR_CULTURE_2_PACKS_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'car-culture-2-packs');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownloaded = 0;
  let totalAssociated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    
    // Filter tables by year - only process tables that belong to targetYear
    const tableYear = extractYearFromHeading($, table);
    if (tableYear !== null) {
      // If we found a year in the heading, it must match targetYear
      if (tableYear !== targetYear) {
        console.log(`Table ${tableIdx + 1}: Skipping table from year ${tableYear} (target: ${targetYear})`);
        continue;
      }
    } else {
      // If no year found in heading, only process if it's the first year (2021)
      // For other years, we require an explicit year heading
      if (targetYear !== 2021) {
        console.log(`Table ${tableIdx + 1}: No year found in heading, skipping (target: ${targetYear}, only 2021 processes tables without year heading)`);
        continue;
      }
    }
    
    const subSeriesName = extractSubSeriesName($, table);
    
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName}`);

    // Parse all rows into RowData
    // Columns for first row: 0=Toy#, 1=Theme, 2=Casting Name, 3=Body Color, 4=Wheel Type, 5=Notes, 6=Photo Loose, 7=Photo Carded
    // Columns for second row: 0=Casting Name, 1=Body Color, 2=Wheel Type, 3=Notes (Toy# and Theme are merged from first row)
    const rowDataList: RowData[] = [];
    let lastToyNumber = '';
    let lastTheme = '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      let toyNumber: string;
      let theme: string;
      let castingNameCell: cheerio.Cheerio<any>;
      let photoCardedUrl: string | null = null;
      let photoLooseUrl: string | null = null;

      // Check if this is a first row (has Toy# and Theme) or second row (starts with Casting Name)
      const firstCell = $(cells[0]).text().trim();
      const isFirstRow = cells.length >= 7 || /^[A-Z]{2,3}\d{2,3}$/.test(firstCell); // Toy# pattern like "HBL97"

      if (isFirstRow) {
        // First row: has Toy#, Theme, and all columns
        toyNumber = firstCell;
        theme = $(cells[COLUMN_THEME]).text().trim();
        castingNameCell = $(cells[COLUMN_CASTING_NAME]);
        
        // Extract Photo Carded image (Column 7)
        if (cells.length > COLUMN_PHOTO_CARDED) {
          const cell = $(cells[COLUMN_PHOTO_CARDED]);
          const imgs = cell.find('img');
          if (imgs.length > 0) {
            const img = imgs.first();
            let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
            if (imgUrl) {
              if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
              }
              photoCardedUrl = imgUrl
                .replace(/\/scale-to-width-down\/\d+/g, '')
                .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
                .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
            }
          }
        }

        // Extract Photo Loose image (Column 6)
        if (cells.length > COLUMN_PHOTO_LOOSE) {
          const cell = $(cells[COLUMN_PHOTO_LOOSE]);
          const imgs = cell.find('img');
          if (imgs.length > 0) {
            const img = imgs.first();
            let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
            if (imgUrl) {
              if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
              }
              photoLooseUrl = imgUrl
                .replace(/\/scale-to-width-down\/\d+/g, '')
                .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
                .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
            }
          }
        }
        
        // Save for next row
        lastToyNumber = toyNumber;
        lastTheme = theme;
      } else {
        // Second row: no Toy# or Theme, starts with Casting Name
        toyNumber = lastToyNumber;
        theme = lastTheme;
        castingNameCell = $(cells[0]);
        
        // Second row: Photo Loose is in Cell 4 (index 4)
        if (cells.length > 4) {
          const cell = $(cells[4]); // Photo Loose is in column 4 for second row
          const imgs = cell.find('img');
          if (imgs.length > 0) {
            const img = imgs.first();
            let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
            if (imgUrl) {
              if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
              }
              photoLooseUrl = imgUrl
                .replace(/\/scale-to-width-down\/\d+/g, '')
                .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
                .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
            }
          }
        }
      }

      const castingName = castingNameCell.find('a').first().text().trim() || castingNameCell.text().trim();

      if (!toyNumber || !theme || !castingName) {
        console.warn(`  Row ${i}: Missing data (Toy#=${toyNumber}, Theme=${theme}, Casting=${castingName})`);
        continue;
      }

      rowDataList.push({
        toyNumber,
        theme,
        castingName,
        photoCardedUrl,
        photoLooseUrl,
        rowIndex: i,
      });
    }

    // Group rows by Toy# and Theme to form sets (2 rows per set)
    const groupedBySet = new Map<string, RowData[]>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.theme}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    console.log(`Found ${groupedBySet.size} sets (grouped by Toy# and Theme)`);

    // Find Collection and SubSeries
    const collection = await prisma.collection.findFirst({
      where: {
        name: 'Car Culture 2-Packs',
        year: { year: targetYear },
      },
    });

    if (!collection) {
      console.warn(`Collection 'Car Culture 2-Packs' not found for year ${targetYear}`);
      continue;
    }

    const subSeries = await prisma.subSeries.findFirst({
      where: {
        name: subSeriesName,
        collectionId: collection.id,
      },
    });

    if (!subSeries) {
      console.warn(`SubSeries '${subSeriesName}' not found`);
      continue;
    }

    // Process each set
    for (const [setKey, setRows] of groupedBySet.entries()) {
      if (setRows.length === 0) continue;

      // Each set should have exactly 2 cars
      if (setRows.length !== 2) {
        console.warn(`Set ${setKey}: Has ${setRows.length} rows (expected 2), skipping`);
        continue;
      }

      const car1 = setRows[0];
      const car2 = setRows[1];

      // Create Model name: "Casting Name 1 & Casting Name 2"
      const modelName = `${car1.castingName} & ${car2.castingName}`;
      const variantReleaseName = `${car1.theme} ${car1.castingName} & ${car2.castingName}`;

      // Find Model
      const model = await prisma.model.findFirst({
        where: {
          castingName: modelName,
          subSeriesId: subSeries.id,
          collectionId: collection.id,
        },
      });

      if (!model) {
        console.warn(`Model '${modelName}' not found for ${subSeriesName}`);
        continue;
      }

      // Find Variant - ONE variant per 2-pack set
      const variant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: car1.toyNumber,
          year: targetYear,
          releaseName: variantReleaseName,
        },
        include: {
          images: true,
        },
      });

      if (!variant) {
        console.warn(`Variant '${variantReleaseName}' not found for ${modelName}`);
        continue;
      }

      // Process Photo Carded image - set as main image (imageId) for Variant
      // Use car1's Photo Carded URL, fallback to car2's if car1 doesn't have one
      const photoCardedUrl = car1.photoCardedUrl || car2.photoCardedUrl;
      
      // Process Photo Carded image - set as main image (imageId) for Variant
      if (photoCardedUrl) {
        try {
          // Check if variant already has a main image
          const existingCardedImage = variant.images.find(img => 
            img.path.includes('carded') || img.alt?.includes('Photo Carded')
          );

          if (!variant.imageId || !existingCardedImage) {
            const urlObj = new URL(photoCardedUrl);
            const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const themeSlug = slugify(car1.theme);
            const themeFolder = path.join(baseDir, themeSlug);
            await fs.promises.mkdir(themeFolder, { recursive: true });
            
            const fileName = `${car1.toyNumber}-carded.${ext}`;
            const destPath = path.join(themeFolder, fileName);
            const relativePath = `/images/hotwheels/${targetYear}/car-culture-2-packs/${themeSlug}/${fileName}`;

            // Check if image record already exists in database
            const existingImageRecord = await prisma.image.findFirst({
              where: {
                path: relativePath,
                variantId: variant.id,
              },
            });

            if (!existingImageRecord) {
              if (!fs.existsSync(destPath)) {
                await downloadImage(photoCardedUrl, destPath);
                totalDownloaded++;
                console.log(`Downloaded Photo Carded for ${variantReleaseName} → ${fileName}`);
              }

              const imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${variantReleaseName} - Photo Carded`,
                  variant: { connect: { id: variant.id } },
                },
              });

              // Update variant.imageId only if it's not set
              if (!variant.imageId) {
                await prisma.variant.update({
                  where: { id: variant.id },
                  data: { imageId: imageRecord.id },
                });
                totalAssociated++;
                console.log(`Associated Photo Carded with Variant ${variantReleaseName}`);
              } else {
                totalAssociated++;
                console.log(`Created Photo Carded image record for ${variantReleaseName} (imageId already set)`);
              }
            } else {
              // Image record exists, but check if imageId needs to be set
              if (!variant.imageId) {
                await prisma.variant.update({
                  where: { id: variant.id },
                  data: { imageId: existingImageRecord.id },
                });
                totalAssociated++;
                console.log(`Set existing Photo Carded as main image for ${variantReleaseName}`);
              }
            }
          } else {
            console.log(`Photo Carded image already exists for ${variantReleaseName}`);
          }
        } catch (err) {
          console.error(`Error processing Photo Carded for ${variantReleaseName}:`, err);
        }
      }

      // Process Photo Loose images - both cars' loose images go to the same variant
      // Check if both cars have the same casting name (need to differentiate with "2nd")
      const sameCastingName = car1.castingName.toLowerCase().trim() === car2.castingName.toLowerCase().trim();
      
      // Process Car 1's loose image
      if (car1.photoLooseUrl) {
        try {
          const urlObj = new URL(car1.photoLooseUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const themeSlug = slugify(car1.theme);
          const castingSlug = slugify(car1.castingName);
          const themeFolder = path.join(baseDir, themeSlug);
          await fs.promises.mkdir(themeFolder, { recursive: true });
          
          const fileName = `${car1.toyNumber}-${castingSlug}-loose.${ext}`;
          const destPath = path.join(themeFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/car-culture-2-packs/${themeSlug}/${fileName}`;

          // Check if image record already exists in database
          const existingImageRecord = await prisma.image.findFirst({
            where: {
              path: relativePath,
              variantId: variant.id,
            },
          });

          // Check if image already exists in variant's images array
          const existingImageInVariant = variant.images.find(img => 
            img.path === relativePath
          );

          if (!existingImageRecord && !existingImageInVariant) {
            if (!fs.existsSync(destPath)) {
              await downloadImage(car1.photoLooseUrl, destPath);
              totalDownloaded++;
              console.log(`Downloaded Photo Loose for ${car1.castingName} → ${fileName}`);
            }

            await prisma.image.create({
              data: {
                path: relativePath,
                alt: `${car1.castingName} - Photo Loose`,
                variant: { connect: { id: variant.id } },
              },
            });
            totalAssociated++;
            console.log(`Associated Photo Loose (Car 1) with Variant ${variantReleaseName}`);
          } else {
            console.log(`Photo Loose image already exists for ${car1.castingName}`);
          }
        } catch (err) {
          console.error(`Error processing Photo Loose for ${car1.castingName}:`, err);
        }
      }

      // Process Car 2's loose image
      if (car2.photoLooseUrl) {
        try {
          const urlObj = new URL(car2.photoLooseUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const themeSlug = slugify(car2.theme);
          const castingSlug = slugify(car2.castingName);
          const themeFolder = path.join(baseDir, themeSlug);
          await fs.promises.mkdir(themeFolder, { recursive: true });
          
          // If both cars have the same casting name, add "2nd" to the second one's filename
          const fileName = sameCastingName 
            ? `${car2.toyNumber}-${castingSlug}-loose-2nd.${ext}`
            : `${car2.toyNumber}-${castingSlug}-loose.${ext}`;
          const destPath = path.join(themeFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/car-culture-2-packs/${themeSlug}/${fileName}`;

          // Check if image record already exists in database
          const existingImageRecord = await prisma.image.findFirst({
            where: {
              path: relativePath,
              variantId: variant.id,
            },
          });

          // Check if image already exists in variant's images array
          const existingImageInVariant = variant.images.find(img => 
            img.path === relativePath
          );

          if (!existingImageRecord && !existingImageInVariant) {
            if (!fs.existsSync(destPath)) {
              await downloadImage(car2.photoLooseUrl, destPath);
              totalDownloaded++;
              console.log(`Downloaded Photo Loose for ${car2.castingName} → ${fileName}`);
            }

            await prisma.image.create({
              data: {
                path: relativePath,
                alt: sameCastingName 
                  ? `${car2.castingName} - Photo Loose (2nd)`
                  : `${car2.castingName} - Photo Loose`,
                variant: { connect: { id: variant.id } },
              },
            });
            totalAssociated++;
            console.log(`Associated Photo Loose (Car 2${sameCastingName ? ' - 2nd' : ''}) with Variant ${variantReleaseName}`);
          } else {
            console.log(`Photo Loose image already exists for ${car2.castingName}${sameCastingName ? ' (2nd)' : ''}`);
          }
        } catch (err) {
          console.error(`Error processing Photo Loose for ${car2.castingName}:`, err);
        }
      }
    }
  }

  console.log(`\nImage download and sync completed. Downloaded ${totalDownloaded} new images, associated ${totalAssociated} images with records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
