/**
 * Script to import Elite 64 2023 collection data and images
 * 
 * This script:
 * 1. Fetches the Elite 64 wiki page
 * 2. Finds the 2023 year section
 * 3. Reads all sub-series for 2023
 * 4. For each sub-series, reads models (Toy#, Series#, Casting Name)
 * 5. Creates database records: Year → Collection → SubSeries → Model → Variant
 * 6. Fetches Casting Name detail pages for additional info (description, etc.)
 * 7. Downloads Photo Carded images (main image) and Photo Loose images (variant images)
 * 
 * Usage:
 *   npx ts-node scripts/import/import_elite64_2023.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const ELITE64_URL = 'https://hotwheels.fandom.com/wiki/Elite_64';
const TARGET_YEAR = 2023;
const YEAR_SEARCH_TEXT = '2023';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function checkImageNotAvailable(imgUrl: string | null, castingName: string): string | null {
  if (!imgUrl) return null;
  
  // Check if it's a "No Image" placeholder
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
  // Ensure URL is absolute
  if (imgUrl.startsWith('//')) {
    imgUrl = 'https:' + imgUrl;
  }
  
  // Remove thumbnail/scale modifiers to get full-size image
  let fullImgUrl = imgUrl
    .replace(/\/scale-to-width-down\/\d+/g, '')
    .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
    .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
  
  return fullImgUrl;
}

async function fetchCastingDetails(castingUrl: string): Promise<{
  description: string | null;
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
}> {
  try {
    const response = await fetch(castingUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch casting page: ${castingUrl}`);
      return {
        description: null,
        debutSeries: null,
        produced: null,
        designer: null,
        castingNumber: null,
      };
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let description: string | null = null;
    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    
    // Try to find infobox or wikitable
    const infobox = $('.infobox, .wikitable').first();
    
    if (infobox.length > 0) {
      infobox.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();
          
          if (/debut|first.*appear/i.test(label)) {
            debutSeries = value || null;
          }
          if (/produced|years/i.test(label)) {
            produced = value || null;
          }
          if (/designer/i.test(label)) {
            designer = value || null;
          }
          if (/number|casting.*number/i.test(label) && !/toy|series/i.test(label)) {
            castingNumber = value || null;
          }
        }
      });
    }
    
    // Try to get description from first paragraph
    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) {
      description = descriptionPara;
    }
    
    return {
      description,
      debutSeries,
      produced,
      designer,
      castingNumber,
    };
  } catch (error) {
    console.warn(`Error fetching casting details from ${castingUrl}:`, error);
    return {
      description: null,
      debutSeries: null,
      produced: null,
      designer: null,
      castingNumber: null,
    };
  }
}

async function processYearSection(
  $: cheerio.CheerioAPI,
  yearHeader: any
): Promise<void> {
  const $section = $(yearHeader);
  
  // Find table after this header
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
    console.warn(`No table found for year ${TARGET_YEAR}`);
    return;
  }
  
  console.log(`Found table for year ${TARGET_YEAR} with ${table.find('tbody tr').length} rows`);

  // Get or create Year record
  let yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: TARGET_YEAR } });
    console.log(`Created Year record for ${TARGET_YEAR}`);
  }

  // Get or create Collection record for Elite 64
  let collectionRecord = await prisma.collection.findFirst({
    where: {
      name: 'Elite 64',
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: 'Elite 64',
        code: 'Elite 64',
        isFuture: false,
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for Elite 64 (${TARGET_YEAR})`);
  }

  const yearFolder = TARGET_YEAR.toString();
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'elite64');
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Find sub-series by looking for headers before tables or in table structure
  // Elite 64 structure: Each sub-series might have its own section or be grouped in the table
  // For now, we'll process all rows and group by sub-series if needed
  
  const tbodyRows = table.find('tbody tr');
  console.log(`\nProcessing ${tbodyRows.length} rows for year ${TARGET_YEAR}...`);

  const subSeriesMap = new Map<string, { id: number }>();
  let modelsCreated = 0;
  let variantsCreated = 0;
  let imagesDownloaded = 0;

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
    const bodyColor = $(cells[3]).text().trim();

    if (!toyNumber || !seriesNumber || !castingName) {
      continue;
    }

    // Get casting URL for details
    const castingUrl = castingNameLink.length > 0 
      ? castingNameLink.attr('href') 
      : null;
    const fullCastingUrl = castingUrl 
      ? (castingUrl.startsWith('http') ? castingUrl : `https://hotwheels.fandom.com${castingUrl}`)
      : null;

    // Fetch casting details
    let castingDetails = {
      description: null as string | null,
      debutSeries: null as string | null,
      produced: null as string | null,
      designer: null as string | null,
      castingNumber: null as string | null,
    };
    
    if (fullCastingUrl) {
      castingDetails = await fetchCastingDetails(fullCastingUrl);
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
    }

    // Determine sub-series name
    // For Elite 64, sub-series might be in a header before the table or in the table structure
    // For now, we'll use a default or try to extract from context
    let subSeriesName = 'Elite 64'; // Default, can be improved
    
    // Try to find sub-series from previous headers or table structure
    const prevHeaders = $section.prevAll('h3, h4').first();
    if (prevHeaders.length > 0) {
      const headerText = $(prevHeaders).text().trim();
      if (headerText && !headerText.match(/^\d{4}$/)) {
        subSeriesName = headerText;
      }
    }

    // Get or create SubSeries
    let subSeries = subSeriesMap.get(subSeriesName);
    if (!subSeries) {
      const existingSubSeries = await prisma.subSeries.findFirst({
        where: {
          name: subSeriesName,
          collectionId: collectionRecord.id,
        },
      });
      
      if (existingSubSeries) {
        subSeries = { id: existingSubSeries.id };
      } else {
        const created = await prisma.subSeries.create({
          data: {
            name: subSeriesName,
            collection: { connect: { id: collectionRecord.id } },
          },
        });
        subSeries = { id: created.id };
        console.log(`Created SubSeries: ${subSeriesName}`);
      }
      subSeriesMap.set(subSeriesName, subSeries);
    }

    // Check if model already exists
    let model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        toyNumber: toyNumber,
        seriesNumber: seriesNumber,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      // Create model
      model = await prisma.model.create({
        data: {
          castingName,
          toyNumber,
          seriesNumber,
          description: castingDetails.description,
          debutSeries: castingDetails.debutSeries,
          produced: castingDetails.produced,
          designer: castingDetails.designer,
          castingNumber: castingDetails.castingNumber,
          collection: { connect: { id: collectionRecord.id } },
          subSeries: { connect: { id: subSeries.id } },
        },
      });
      modelsCreated++;
      console.log(`Created Model: ${castingName} (Toy#: ${toyNumber}, Series#: ${seriesNumber})`);
    } else {
      // Update model details if they're missing
      const updateData: any = {};
      if (!model.description && castingDetails.description) updateData.description = castingDetails.description;
      if (!model.debutSeries && castingDetails.debutSeries) updateData.debutSeries = castingDetails.debutSeries;
      if (!model.produced && castingDetails.produced) updateData.produced = castingDetails.produced;
      if (!model.designer && castingDetails.designer) updateData.designer = castingDetails.designer;
      if (!model.castingNumber && castingDetails.castingNumber) updateData.castingNumber = castingDetails.castingNumber;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.model.update({
          where: { id: model.id },
          data: updateData,
        });
      }
    }

    // Create variant (Elite 64 typically has one variant per model)
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        year: TARGET_YEAR,
        color: bodyColor || undefined,
      },
    });

    let variant;
    if (!existingVariant) {
      variant = await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: TARGET_YEAR,
          releaseName: subSeriesName,
          color: bodyColor || undefined,
        },
      });
      variantsCreated++;
    } else {
      variant = existingVariant;
    }

    // Process images
    // Find Photo Carded and Photo Loose columns
    let photoCardedColIdx = 5; // Default
    let photoLooseColIdx = 4; // Default
    
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
              console.log(`  Downloaded Photo Carded: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`  Error downloading Photo Carded for ${castingName}:`, err);
            }
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
            
            // Set as main image
            await prisma.model.update({
              where: { id: model.id },
              data: { mainImageId: imageRecord.id },
            });
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error(`  Error creating Photo Carded image record:`, err);
            }
          }
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
              console.log(`  Downloaded Photo Loose: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`  Error downloading Photo Loose for ${castingName}:`, err);
            }
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
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error(`  Error creating Photo Loose image record:`, err);
            }
          }
        }
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nYear ${TARGET_YEAR} complete:`);
  console.log(`  Models created: ${modelsCreated}`);
  console.log(`  Variants created: ${variantsCreated}`);
  console.log(`  Images downloaded: ${imagesDownloaded}`);
}

async function main() {
  console.log('Fetching Elite 64 page...');
  const response = await fetch(ELITE64_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ELITE64_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find 2023 header
  const allHeaders = $('h2');
  let yearHeader: any = null;
  
  allHeaders.each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes(YEAR_SEARCH_TEXT)) {
      yearHeader = el;
      return false; // break
    }
  });
  
  if (!yearHeader) {
    console.log(`Year ${TARGET_YEAR} section not found, skipping...`);
    return;
  }
  
  console.log(`Found header for year ${TARGET_YEAR}: "${$(yearHeader).text().trim()}"`);
  await processYearSection($, yearHeader);

  console.log('\n=== FINAL SUMMARY ===');
  console.log('Elite 64 2023 import completed successfully!');
}

main()
  .catch((err) => {
    console.error('Error during import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

