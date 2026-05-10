/**
 * Script to download image assets for the 2024 Hot Wheels Team Transport set and
 * associate them with Model and Variant records in your database.
 *
 * This script performs two jobs:
 *   1. Fetches the 2024 Team Transport page from the Hot Wheels Fandom wiki and
 *      extracts image URLs from tables (Photo Carded and Photo Loose columns).
 *      It downloads each image file and saves it to the designated
 *      `public/images/hotwheels/2024/team-transport/` folder.
 *   2. Associates images with database records:
 *      - Photo Carded (Column 8) → Model's mainImageId (for the primary Model Araba)
 *      - Photo Loose (Column 7) → Variant's images (for each casting's variant)
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2024 Team Transport variants using the import script.
 *   - The script matches images by Toy#, Series#, and Casting Name to find corresponding
 *     Models and Variants in the database.
 *   - Photo Carded images are set as the main image for the Model Araba.
 *   - Photo Loose images: Each casting has its own loose image in Column 7
 *   - For sets with 2 car castings, each car casting's loose image is processed separately
 *   - The script skips downloading an image if the file already exists
 *     locally and skips creating Image records if they already exist.
 *   - Running this script multiple times is safe; it will only download
 *     missing images and create missing associations.
 *
 * Usage:
 *   npx ts-node scripts/tools/download_and_sync_images_2024_team_transport.ts
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TEAM_TRANSPORT_URL = 'https://hotwheels.fandom.com/wiki/2024_Car_Culture:_Team_Transport';
const targetYear = 2024;

// Column indices (0-based)
const COLUMN_PHOTO_LOOSE = 7;  // Column 7: Photo Loose (her casting için)
const COLUMN_PHOTO_CARDED = 8; // Column 8: Photo Carded (ana resim)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
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
  
  return subSeriesName || 'Unknown Series';
}

interface RowData {
  toyNumber: string;
  seriesNumber: string;
  castingName: string;
  photoCardedUrl: string | null;
  photoLooseUrl: string | null;
  rowIndex: number;
  isTransport: boolean;
}

async function main() {
  console.log(`Fetching ${targetYear} Team Transport page…`);
  const resp = await fetch(TEAM_TRANSPORT_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${TEAM_TRANSPORT_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s). Processing…`);

  if (tables.length === 0) {
    throw new Error(`Could not find any tables on the page ${TEAM_TRANSPORT_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'team-transport');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownloaded = 0;
  let totalAssociated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
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

    // Detect column indices from header
    const headerRow = $(table).find('thead tr, tbody tr').first();
    const headerCells = headerRow.find('th, td');
    let photoLooseColIdx = COLUMN_PHOTO_LOOSE;
    let photoCardedColIdx = COLUMN_PHOTO_CARDED;
    let castingColIdx = 2; // Default: Column 2 for transport row
    
    // Try to detect columns from header
    headerCells.each((idx, cell) => {
      const text = $(cell).text().trim().toLowerCase();
      if ((text.includes('photo') && text.includes('loose')) || text.includes('loose')) {
        photoLooseColIdx = idx;
      } else if ((text.includes('photo') && text.includes('carded')) || text.includes('carded')) {
        photoCardedColIdx = idx;
      } else if (text.includes('casting') && !text.includes('name')) {
        // Note: User said "Casting" not "Casting Name" in table headers
        castingColIdx = idx;
      }
    });
    
    console.log(`Column mapping: Casting=${castingColIdx}, Photo Loose=${photoLooseColIdx}, Photo Carded=${photoCardedColIdx}`);

    // Special handling for "Supreme Exclusive", "Walmart Legends Tour Exclusive", or "Fast & Furious" - it might have a different table structure
    const isSupremeExclusive = subSeriesName.toLowerCase().includes('supreme') || subSeriesName.toLowerCase().includes('walmart') || subSeriesName.toLowerCase().includes('fast') || subSeriesName.toLowerCase().includes('furious');

    // Parse all rows into RowData
    // Each row represents a casting (transport or car), each has its own Photo Loose in Column 7
    const rowDataList: RowData[] = [];
    let currentToyNumber = '';
    let currentSeriesNumber = '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract cell values
      const cellValues: string[] = [];
      cells.each((idx, cell) => {
        cellValues.push($(cell).text().trim());
      });

      // Check if this is a transport row (has Toy# and Series#) or car row
      const firstCell = cellValues[0] || '';
      const secondCell = cellValues[1] || '';
      
      let toyNumber = '';
      let seriesNumber = '';
      let castingNameRaw = '';
      let photoCardedUrl: string | null = null;
      let photoLooseUrl: string | null = null;
      let isTransport = false;
      
      // Transport row pattern: First cell is Toy# (short alphanumeric), second is Series# (digit or N/A for Supreme Exclusive/Walmart/Fast & Furious)
      const isValidSeriesNumber = /^\d+$/.test(secondCell) && parseInt(secondCell, 10) <= 100;
      const isNAForSupreme = isSupremeExclusive && secondCell.toUpperCase() === 'N/A';
      
      if (firstCell.length >= 3 && firstCell.length <= 8 && /^[A-Z0-9]+$/i.test(firstCell) && !firstCell.includes(' ') &&
          (isValidSeriesNumber || isNAForSupreme)) {
        // This is a transport row
        isTransport = true;
        toyNumber = firstCell;
        // For Supreme Exclusive/Walmart/Fast & Furious with N/A, use Toy# as Series# to create unique set identifier
        seriesNumber = isNAForSupreme ? firstCell : secondCell;
        currentToyNumber = toyNumber;
        currentSeriesNumber = seriesNumber;
        
        // Parse casting name (from detected casting column for transport row)
        if (cells.length > castingColIdx) {
          const cell = $(cells[castingColIdx]);
          const link = cell.find('a').first();
          if (link.length > 0) {
            castingNameRaw = link.text().trim();
          } else {
            castingNameRaw = cell.text().trim();
          }
        }
        
        // Extract Photo Carded image (from detected column)
        if (cells.length > photoCardedColIdx) {
          const cell = $(cells[photoCardedColIdx]);
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
      } else {
        // This is a car row - inherit Toy# and Series# from previous transport row
        isTransport = false;
        toyNumber = currentToyNumber;
        seriesNumber = currentSeriesNumber;
        
        if (!toyNumber || !seriesNumber) {
          continue;
        }
        
        // Car row pattern: First cell is Casting Name (but column index might be different)
        // Try to find casting name - it should be in the first non-empty cell
        for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
          const cell = $(cells[cellIdx]);
          const text = cell.text().trim();
          // Skip if it looks like a number (Series#) or empty
          if (text && !/^\d+$/.test(text) && text.length > 2) {
            const link = cell.find('a').first();
            if (link.length > 0) {
              castingNameRaw = link.text().trim();
            } else {
              castingNameRaw = text;
            }
            break;
          }
        }
      }

      // Extract Photo Loose image (for both transport and car rows)
      // Strategy: Try detected column index first, if not found, search all cells
      let looseCol = photoLooseColIdx;
      let foundLooseImage = false;
      
      // First, try the detected column index
      if (cells.length > looseCol) {
        const cell = $(cells[looseCol]);
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
            foundLooseImage = true;
          }
        }
      }
      
      // If not found and this is a car row, search all cells for loose images
      // Car rows might have different column structure
      if (!foundLooseImage && !isTransport) {
        // Search all cells for images that might be loose images
        // Look for images in cells that don't contain "carded" in the URL
        for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
          const cell = $(cells[cellIdx]);
          const imgs = cell.find('img');
          if (imgs.length > 0) {
            // Check each image to see if it's a loose image
            imgs.each((_, img) => {
              let imgUrl = $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-original');
              if (imgUrl) {
                // Skip if it looks like a carded image
                const urlLower = imgUrl.toLowerCase();
                if (urlLower.includes('carded') || urlLower.includes('packaged')) {
                  return;
                }
                
                // This might be a loose image
                if (imgUrl.startsWith('//')) {
                  imgUrl = 'https:' + imgUrl;
                }
                const fullImgUrl = imgUrl
                  .replace(/\/scale-to-width-down\/\d+/g, '')
                  .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
                  .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
                
                // Take the first loose image found
                if (!photoLooseUrl) {
                  photoLooseUrl = fullImgUrl;
                  foundLooseImage = true;
                  console.log(`    Row ${i} (car): Found Photo Loose in cell ${cellIdx} (fallback search)`);
                  return false; // Break the loop
                }
              }
            });
            if (foundLooseImage) break;
          }
        }
      }

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        console.warn(`  Row ${i}: Missing data (Toy#=${toyNumber}, Series#=${seriesNumber}, Casting=${castingNameRaw})`);
        continue;
      }
      
      // Debug log for car rows to see what we found
      if (!isTransport) {
        console.log(`  Row ${i} (car): Casting="${castingNameRaw}", cells.length=${cells.length}, looseCol=${looseCol}, photoLooseUrl=${photoLooseUrl ? 'found' : 'NOT FOUND'}`);
      }

      rowDataList.push({
        toyNumber,
        seriesNumber,
        castingName: castingNameRaw,
        photoCardedUrl,
        photoLooseUrl,
        rowIndex: i,
        isTransport,
      });
    }

    // Group rows by Toy# and Series# to form sets
    const groupedBySet = new Map<string, RowData[]>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.seriesNumber}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    console.log(`Found ${groupedBySet.size} sets (grouped by Toy# and Series#)`);

    // Process each set
    for (const [setKey, setRows] of groupedBySet.entries()) {
      if (setRows.length === 0) continue;

      // Find transport row and car rows
      const transportRow = setRows.find(r => r.isTransport);
      const carRows = setRows.filter(r => !r.isTransport);

      if (!transportRow) {
        console.warn(`Set ${setKey}: No transport row found, skipping`);
        continue;
      }

      if (carRows.length === 0) {
        console.warn(`Set ${setKey}: No car rows found, skipping`);
        continue;
      }

      // Create Model Araba name from car castings
      let modelArabaName: string;
      if (carRows.length === 1) {
        modelArabaName = carRows[0].castingName;
      } else {
        modelArabaName = carRows.map(r => r.castingName).join(' & ');
      }

      // Find Collection, SubSeries, and Model Araba
      const collection = await prisma.collection.findFirst({
        where: {
          name: 'Team Transport',
          year: { year: targetYear },
        },
      });

      if (!collection) {
        console.warn(`Collection 'Team Transport' not found for year ${targetYear}`);
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

      const modelAraba = await prisma.model.findFirst({
        where: {
          castingName: modelArabaName,
          subSeriesId: subSeries.id,
          collectionId: collection.id,
        },
      });

      if (!modelAraba) {
        console.warn(`Model Araba '${modelArabaName}' not found for ${subSeriesName}`);
        continue;
      }

      // Process Photo Carded image (Column 8) - set as main image for Model Araba
      if (transportRow.photoCardedUrl && !modelAraba.mainImageId) {
        try {
          const urlObj = new URL(transportRow.photoCardedUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `carded-${transportRow.toyNumber}-${transportRow.seriesNumber}.${ext}`;
          const destPath = path.join(baseDir, fileName);

          if (!fs.existsSync(destPath)) {
            await downloadImage(transportRow.photoCardedUrl, destPath);
            totalDownloaded++;
            console.log(`Downloaded Photo Carded for ${modelArabaName} → ${fileName}`);
          }

          const relativePath = `/images/hotwheels/${targetYear}/team-transport/${fileName}`;
          const imageRecord = await prisma.image.create({
            data: {
              path: relativePath,
              alt: `${modelArabaName} - Photo Carded`,
              model: { connect: { id: modelAraba.id } },
            },
          });

          await prisma.model.update({
            where: { id: modelAraba.id },
            data: { mainImageId: imageRecord.id },
          });
          totalAssociated++;
          console.log(`Associated Photo Carded with Model Araba ${modelArabaName}`);
        } catch (err) {
          console.error(`Error processing Photo Carded for ${modelArabaName}:`, err);
        }
      }

      // Process Photo Loose images (Column 7) - each casting has its own loose image
      // Process transport casting's loose image
      if (transportRow.photoLooseUrl) {
        try {
          // Find the transport variant under Model Araba
          let variant = await prisma.variant.findFirst({
            where: {
              modelId: modelAraba.id,
              cardNumber: transportRow.seriesNumber,
              year: targetYear,
              releaseName: { contains: 'Transport' },
            },
          });

          if (variant) {
            // Check if this image already exists for this variant
            const existingImage = await prisma.image.findFirst({
              where: {
                variantId: variant.id,
                path: { contains: `loose-${transportRow.toyNumber}-${transportRow.seriesNumber}-transport` },
              },
            });

            if (!existingImage) {
              const urlObj = new URL(transportRow.photoLooseUrl);
              const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
              const ext = extMatch ? extMatch[1] : 'jpg';
              const fileName = `loose-${transportRow.toyNumber}-${transportRow.seriesNumber}-transport.${ext}`;
              const destPath = path.join(baseDir, fileName);

              if (!fs.existsSync(destPath)) {
                await downloadImage(transportRow.photoLooseUrl, destPath);
                totalDownloaded++;
                console.log(`Downloaded Photo Loose for transport ${transportRow.castingName} → ${fileName}`);
              }

              const relativePath = `/images/hotwheels/${targetYear}/team-transport/${fileName}`;
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${transportRow.castingName} - Photo Loose (Transport)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              totalAssociated++;
              console.log(`Associated Photo Loose with transport variant ${transportRow.castingName}`);
            } else {
              console.log(`  Photo Loose image already exists for transport ${transportRow.castingName}, skipping`);
            }
          } else {
            console.warn(`Transport variant not found for ${modelArabaName} (Model ID: ${modelAraba.id}, Series#: ${transportRow.seriesNumber}, Year: ${targetYear})`);
          }
        } catch (err) {
          console.error(`Error processing Photo Loose for transport ${transportRow.castingName}:`, err);
        }
      }

      // Process each car casting's loose image
      // This loop handles multiple car castings (e.g., 2 car castings = 2 loose images)
      for (let carIdx = 0; carIdx < carRows.length; carIdx++) {
        const carRow = carRows[carIdx];
        
        if (!carRow.photoLooseUrl) {
          console.warn(`  Car row ${carIdx + 1}/${carRows.length} (${carRow.castingName}) has no Photo Loose URL in Column 7`);
          continue;
        }

        try {
          // Find the car variant under Model Araba
          // Try exact match first: "Mix X - CastingName"
          let variant = await prisma.variant.findFirst({
            where: {
              modelId: modelAraba.id,
              cardNumber: transportRow.seriesNumber,
              year: targetYear,
              releaseName: `${subSeriesName} - ${carRow.castingName}`,
            },
          });

          // If not found, try contains match
          if (!variant) {
            variant = await prisma.variant.findFirst({
              where: {
                modelId: modelAraba.id,
                cardNumber: transportRow.seriesNumber,
                year: targetYear,
                releaseName: { contains: carRow.castingName },
              },
            });
          }

          if (!variant) {
            console.warn(`Car variant not found for ${carRow.castingName} under ${modelArabaName} (Model ID: ${modelAraba.id}, Series#: ${transportRow.seriesNumber}, Year: ${targetYear})`);
            console.warn(`  Looking for releaseName: "${subSeriesName} - ${carRow.castingName}"`);
            const allVariants = await prisma.variant.findMany({
              where: { modelId: modelAraba.id },
            });
            console.warn(`  Available variants for ${modelArabaName}: ${allVariants.map(v => `ID=${v.id}, releaseName="${v.releaseName}", cardNumber=${v.cardNumber}, year=${v.year}`).join('; ')}`);
            continue;
          }
          
          console.log(`  Found car variant ${carIdx + 1}/${carRows.length}: ${variant.releaseName} (ID: ${variant.id})`);

          // Check if this image already exists for this variant
          const existingImage = await prisma.image.findFirst({
            where: {
              variantId: variant.id,
              path: { contains: `loose-${transportRow.toyNumber}-${transportRow.seriesNumber}-car${carIdx + 1}` },
            },
          });

          if (existingImage) {
            console.log(`  Photo Loose image already exists for car ${carRow.castingName}, skipping`);
            continue;
          }

          const urlObj = new URL(carRow.photoLooseUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `loose-${transportRow.toyNumber}-${transportRow.seriesNumber}-car${carIdx + 1}.${ext}`;
          const destPath = path.join(baseDir, fileName);

          if (!fs.existsSync(destPath)) {
            await downloadImage(carRow.photoLooseUrl, destPath);
            totalDownloaded++;
            console.log(`Downloaded Photo Loose for car ${carIdx + 1}/${carRows.length} (${carRow.castingName}) → ${fileName}`);
          }

          const relativePath = `/images/hotwheels/${targetYear}/team-transport/${fileName}`;
          await prisma.image.create({
            data: {
              path: relativePath,
              alt: `${carRow.castingName} - Photo Loose (Car ${carIdx + 1})`,
              variant: { connect: { id: variant.id } },
            },
          });
          totalAssociated++;
          console.log(`Associated Photo Loose with car variant ${carRow.castingName} (${carIdx + 1}/${carRows.length})`);
        } catch (err) {
          console.error(`Error processing Photo Loose for car ${carRow.castingName}:`, err);
        }
      }
    }
  }

  console.log(`\nDownload complete. ${totalDownloaded} images downloaded, ${totalAssociated} associations created.`);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


