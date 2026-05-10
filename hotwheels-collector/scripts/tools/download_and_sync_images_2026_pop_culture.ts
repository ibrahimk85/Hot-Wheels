/**
 * Script to download image assets for the 2026 Hot Wheels Pop Culture series.
 * 
 * This script:
 *   1. Fetches the Pop Culture table from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs
 *   3. Downloads images to public/images/hotwheels/2026/pop-culture/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Pop Culture-specific:
 * - Photo Carded: Main image (variant.imageId)
 * - Photo Loose: Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - Variant matching uses: Theme + cardNumber (1/5, 2/5, etc.) + Casting Name
 * - 2026 table: Toy # | Casting Name | Theme | Body Color | Wheel Type | Notes | Photo Loose | Photo Carded
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2026_pop_culture.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2026;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Pop_Culture`;

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  const sanitized = sanitizeFileName(name);
  return sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  await fs.promises.mkdir(dir, { recursive: true });
  
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
  
  const cleaned = (subSeriesName || 'Unknown Series').replace(/\[\]$/, '');
  return cleaned;
}

async function main() {
  console.log('=== POP CULTURE IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);
  
  console.log(`Fetching ${targetYear} Pop Culture page…`);
  const resp = await fetch(WIKI_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);
  
  const tables = $('table.wikitable');
  
  if (tables.length === 0) {
    throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'pop-culture');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    if (/^(contents|references|see also|external links|categories|team transport|gallery)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }
    
    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    const rowCount = rows.length;
    console.log(`Processing ${rowCount} rows from ${subSeriesName}…`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      // 2026: Toy # | Casting Name | Theme | Body Color | Wheel Type | Notes | Photo Loose | Photo Carded
      const toyNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const castingNameLink = $(cells[1]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0 
        ? castingNameLink.text().trim() 
        : $(cells[1]).text().trim();
      const theme = cells.length > 2 ? $(cells[2]).text().trim() : '';
      const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const seriesNumber = `${i + 1}/${rowCount}`;

      if (!toyNumber || !castingNameRaw) {
        continue;
      }

      const castingName = castingNameRaw;

      const model = await prisma.model.findFirst({
        where: {
          castingName: castingName,
          subSeries: {
            name: subSeriesName,
            collection: {
              name: 'Pop Culture',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${subSeriesName})`);
        continue;
      }

      const variantWhere: any = {
        modelId: model.id,
        cardNumber: seriesNumber,
        year: targetYear,
      };
      
      if (theme && theme.trim() !== '') {
        variantWhere.theme = theme.trim();
      } else {
        variantWhere.theme = null;
      }
      
      if (bodyColor && bodyColor.trim() !== '') {
        variantWhere.color = bodyColor.trim();
      } else {
        variantWhere.color = null;
      }
      
      const variant = await prisma.variant.findFirst({
        where: variantWhere,
      });

      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${seriesNumber} Theme: ${theme || 'N/A'}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const cardedColIdx = cells.length - 1;
      if (cells.length > cardedColIdx) {
        const cardedImgElement = $(cells[cardedColIdx]).find('img').first();
        const cardedImgUrlRaw = cardedImgElement.attr('data-src') || cardedImgElement.attr('src');
        
        if (cardedImgUrlRaw) {
          let cardedImgUrl = cardedImgUrlRaw;
          if (cardedImgUrl.startsWith('//')) {
            cardedImgUrl = 'https:' + cardedImgUrl;
          }
          let fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(`${fullCardedUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const sanitizedToyNumber = sanitizeFileName(toyNumber);
          const fileName = `${sanitizedToyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(fullCardedUrl, destPath);
              downloadCount++;
              console.log(`Downloaded carded image: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading carded image:`, err);
            }
          }

          if (!variant.imageId && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/pop-culture/${castingSlug}/${fileName}`;
            try {
              const imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Carded)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              await prisma.variant.update({
                where: { id: variant.id },
                data: { imageId: imageRecord.id },
              });
              associatedCount++;
              console.log(`Associated carded image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating carded image:`, err);
            }
          }
        }
      }

      const looseColIdx = cells.length - 2;
      if (cells.length > looseColIdx && looseColIdx >= 0) {
        const looseImgElement = $(cells[looseColIdx]).find('img').first();
        const looseImgUrlRaw = looseImgElement.attr('data-src') || looseImgElement.attr('src');
        
        if (looseImgUrlRaw) {
          let looseImgUrl = looseImgUrlRaw;
          if (looseImgUrl.startsWith('//')) {
            looseImgUrl = 'https:' + looseImgUrl;
          }
          let fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(`${fullLooseUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const sanitizedToyNumber = sanitizeFileName(toyNumber);
          const fileName = `${sanitizedToyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          const existingLooseImage = await prisma.image.findFirst({
            where: {
              variantId: variant.id,
              path: {
                contains: `${sanitizedToyNumber}_loose`,
              },
            },
          });

          if (!fs.existsSync(destPath) && !existingLooseImage) {
            try {
              await downloadImage(fullLooseUrl, destPath);
              downloadCount++;
              console.log(`Downloaded loose image: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading loose image:`, err);
            }
          }

          if (!existingLooseImage && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/pop-culture/${castingSlug}/${fileName}`;
            try {
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated loose image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating loose image:`, err);
            }
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
