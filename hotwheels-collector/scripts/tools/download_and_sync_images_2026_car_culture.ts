/**
 * Script to download image assets for the 2026 Hot Wheels Car Culture series.
 * 
 * This script:
 *   1. Fetches the Car Culture table from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs
 *   3. Downloads images to public/images/hotwheels/2026/car-culture/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Car Culture-specific:
 * - Photo Carded: Main image (variant.imageId)
 * - Photo Loose: Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2026_car_culture.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2026;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Car_Culture`;

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(name: string): string {
  return name
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

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>): {
  toyNumber: string;
  seriesNumber: string;
  castingName: string;
  bodyColor: string;
} {
  const cell0 = $(cells[0]).text().trim();
  const cell1 = $(cells[1]).text().trim();
  const isCollectorFirst = /^\d+\/\d+$/.test(cell0) && /^[A-Z]{2,3}\d+$/.test(cell1);
  const toyNumberRaw = isCollectorFirst ? cell1 : cell0;
  const toyNumber = sanitizeFileName(toyNumberRaw);
  const seriesNumber = isCollectorFirst ? cell0 : cell1;
  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0
    ? castingNameLink.text().trim()
    : $(cells[2]).text().trim();
  const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber, seriesNumber, castingName, bodyColor };
}

async function main() {
  console.log('=== CAR CULTURE IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);

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

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'car-culture');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);

    if (/^(contents|references|see also|external links|categories|team transport)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Processing ${rows.length} rows from ${subSeriesName}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      const { toyNumber, seriesNumber, castingName, bodyColor } = parseRow($, cells);
      if (!toyNumber || !seriesNumber || !castingName) continue;

      const model = await prisma.model.findFirst({
        where: {
          castingName,
          subSeries: {
            name: subSeriesName,
            collection: {
              name: 'Car Culture',
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
      if (bodyColor && bodyColor.trim() !== '') {
        variantWhere.color = bodyColor.trim();
      } else {
        variantWhere.color = null;
      }

      const variant = await prisma.variant.findFirst({ where: variantWhere });
      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${seriesNumber}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const cardedColIdx = cells.length - 1;
      const looseColIdx = cells.length - 2;

      if (cells.length > cardedColIdx) {
        const cardedImgElement = $(cells[cardedColIdx]).find('img').first();
        const cardedImgUrlRaw = cardedImgElement.attr('data-src') || cardedImgElement.attr('src');
        if (cardedImgUrlRaw) {
          let cardedImgUrl = cardedImgUrlRaw.startsWith('//') ? 'https:' + cardedImgUrlRaw : cardedImgUrlRaw;
          let fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(`${fullCardedUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_carded.${ext}`;
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
            const relativePath = `/images/hotwheels/${targetYear}/car-culture/${castingSlug}/${fileName}`;
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

      if (looseColIdx >= 0 && cells.length > looseColIdx) {
        const looseImgElement = $(cells[looseColIdx]).find('img').first();
        const looseImgUrlRaw = looseImgElement.attr('data-src') || looseImgElement.attr('src');
        if (looseImgUrlRaw) {
          let looseImgUrl = looseImgUrlRaw.startsWith('//') ? 'https:' + looseImgUrlRaw : looseImgUrlRaw;
          let fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(`${fullLooseUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          const existingLooseImage = await prisma.image.findFirst({
            where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } },
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
            const relativePath = `/images/hotwheels/${targetYear}/car-culture/${castingSlug}/${fileName}`;
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
