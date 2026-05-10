/**
 * Script to download image assets for 2025 Hot Wheels Silver Series - Purple and Gold.
 *
 * This script:
 *   1. Fetches the Purple and Gold Series (2025) page from Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs from tables
 *   3. Downloads to public/images/hotwheels/2025/silver-series/purple-and-gold/{castingSlug}/
 *   4. Associates images with Variant records
 *
 * Table columns: Col# | Toy# | Casting Name | Color | Tampo | Wheel Type | Notes | Photo Loose | Photo Carded
 *
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2025_silver_series_purple_and_gold.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2025;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Purple_and_Gold_Series_(2025)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Purple and Gold (2025)';
const BASE_SUBDIR = 'silver-series/purple-and-gold';

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
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const text = prevHeading.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(text)) {
      return text;
    }
  }
  const caption = $(table).find('caption').text().trim().replace(/\[\]$/, '');
  if (caption) return caption;
  return 'Unknown Mix';
}

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>): {
  toyNumber: string;
  colNumber: string;
  castingName: string;
  color: string;
} {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumberRaw = cells.length > 1 ? $(cells[1]).text().trim() : '';
  const toyNumber = sanitizeFileName(toyNumberRaw);
  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0
    ? castingNameLink.text().trim()
    : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber, colNumber, castingName, color };
}

async function main() {
  console.log('=== PURPLE AND GOLD (2025) IMAGE DOWNLOAD SCRIPT ===');
  console.log(`URL: ${WIKI_URL}`);

  const resp = await fetch(WIKI_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) {
    throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);
    const subSeriesName = `${SERIES_NAME} - ${mixName}`;

    if (/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(mixName)) {
      console.log(`Skipping table: ${mixName}`);
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
      if (cells.length < 3) continue;

      const { toyNumber, colNumber, castingName, color } = parseRow($, cells);
      if (!toyNumber || !castingName) continue;

      const model = await prisma.model.findFirst({
        where: {
          castingName,
          subSeries: {
            name: subSeriesName,
            collection: {
              name: COLLECTION_NAME,
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
        cardNumber: colNumber || undefined,
        year: targetYear,
      };
      variantWhere.color = color && color.trim() !== '' ? color.trim() : null;

      const variant = await prisma.variant.findFirst({ where: variantWhere });
      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${colNumber}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const looseColIdx = 7;
      const cardedColIdx = 8;

      if (cells.length > cardedColIdx) {
        const cardedImgElement = $(cells[cardedColIdx]).find('img').first();
        const cardedImgUrlRaw = cardedImgElement.attr('data-src') || cardedImgElement.attr('src');
        if (cardedImgUrlRaw && !cardedImgUrlRaw.includes('Image_Not_Available')) {
          let cardedImgUrl = cardedImgUrlRaw.startsWith('//') ? 'https:' + cardedImgUrlRaw : cardedImgUrlRaw;
          const fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(fullCardedUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;

          if (!fs.existsSync(destPath)) {
            try {
              await downloadImage(fullCardedUrl, destPath);
              downloadCount++;
              console.log(`Downloaded carded: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading carded image:`, err);
            }
          }

          if (!variant.imageId && fs.existsSync(destPath)) {
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
              console.log(`Associated carded image: ${castingName}`);
            } catch (err) {
              console.error(`Error associating carded image:`, err);
            }
          }
        }
      }

      if (cells.length > looseColIdx) {
        const looseImgElement = $(cells[looseColIdx]).find('img').first();
        const looseImgUrlRaw = looseImgElement.attr('data-src') || looseImgElement.attr('src');
        if (looseImgUrlRaw && !looseImgUrlRaw.includes('Image_Not_Available')) {
          let looseImgUrl = looseImgUrlRaw.startsWith('//') ? 'https:' + looseImgUrlRaw : looseImgUrlRaw;
          const fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(fullLooseUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;

          const existingLooseImage = await prisma.image.findFirst({
            where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } },
          });

          if (!fs.existsSync(destPath) && !existingLooseImage) {
            try {
              await downloadImage(fullLooseUrl, destPath);
              downloadCount++;
              console.log(`Downloaded loose: ${castingName} → ${fileName}`);
            } catch (err) {
              console.error(`Error downloading loose image:`, err);
            }
          }

          if (!existingLooseImage && fs.existsSync(destPath)) {
            try {
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated loose image: ${castingName}`);
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
