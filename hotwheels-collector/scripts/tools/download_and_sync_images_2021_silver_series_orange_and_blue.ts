/**
 * Script to download image assets for 2021 Hot Wheels Silver Series - Orange and Blue.
 *
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2021_silver_series_orange_and_blue.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2021;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Orange_and_Blue_Series_(2021)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Orange and Blue (2021)';
const BASE_SUBDIR = 'silver-series/orange-and-blue';

function sanitizeFileName(name: string): string { return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim(); }
function slugify(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

async function downloadImage(url: string, dest: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await fs.promises.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  const prev = $(table).prevAll('h2, h3, h4').first();
  if (prev.length > 0) {
    const text = prev.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(text)) return text;
  }
  const cap = $(table).find('caption').text().trim().replace(/\[\]$/, '');
  return cap || 'Unknown Mix';
}

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>): { toyNumber: string; colNumber: string; castingName: string; color: string } {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = sanitizeFileName(cells.length > 1 ? $(cells[1]).text().trim() : '');
  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0 ? castingNameLink.text().trim() : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber, colNumber, castingName, color };
}

async function main() {
  console.log('=== ORANGE AND BLUE (2021) IMAGE DOWNLOAD SCRIPT ===');
  console.log(`URL: ${WIKI_URL}`);

  const resp = await fetch(WIKI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);
  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not locate any tables on ${WIKI_URL}`);

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });
  let downloadCount = 0, associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);
    const subSeriesName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(mixName)) { console.log(`Skipping table: ${mixName}`); continue; }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => $(row).find('td').length >= 3);
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
          subSeries: { name: subSeriesName, collection: { name: COLLECTION_NAME, year: { year: targetYear } } },
        },
      });
      if (!model) { console.warn(`Model not found: ${castingName} (${subSeriesName})`); continue; }

      const variantWhere: any = { modelId: model.id, cardNumber: colNumber || undefined, year: targetYear };
      variantWhere.color = color && color.trim() !== '' ? color.trim() : null;
      const variant = await prisma.variant.findFirst({ where: variantWhere });
      if (!variant) { console.warn(`Variant not found: ${castingName} #${colNumber}`); continue; }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });
      const looseColIdx = 7, cardedColIdx = 8;

      if (cells.length > cardedColIdx) {
        const cardedImg = $(cells[cardedColIdx]).find('img').first();
        const cardedUrlRaw = cardedImg.attr('data-src') || cardedImg.attr('src');
        if (cardedUrlRaw && !cardedUrlRaw.includes('Image_Not_Available')) {
          let url = cardedUrlRaw.startsWith('//') ? 'https:' + cardedUrlRaw : cardedUrlRaw;
          url = url.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const extMatch = url.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;

          if (!fs.existsSync(destPath)) {
            try { await downloadImage(url, destPath); downloadCount++; console.log(`Downloaded carded: ${castingName} → ${fileName}`); }
            catch (err) { console.error(`Error downloading carded image:`, err); }
          }
          if (!variant.imageId && fs.existsSync(destPath)) {
            try {
              const img = await prisma.image.create({ data: { path: relativePath, alt: `${castingName} (Carded)`, variant: { connect: { id: variant.id } } } });
              await prisma.variant.update({ where: { id: variant.id }, data: { imageId: img.id } });
              associatedCount++; console.log(`Associated carded image: ${castingName}`);
            } catch (err) { console.error(`Error associating carded image:`, err); }
          }
        }
      }

      if (cells.length > looseColIdx) {
        const looseImg = $(cells[looseColIdx]).find('img').first();
        const looseUrlRaw = looseImg.attr('data-src') || looseImg.attr('src');
        if (looseUrlRaw && !looseUrlRaw.includes('Image_Not_Available')) {
          let url = looseUrlRaw.startsWith('//') ? 'https:' + looseUrlRaw : looseUrlRaw;
          url = url.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const extMatch = url.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;
          const existingLoose = await prisma.image.findFirst({ where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } } });

          if (!fs.existsSync(destPath) && !existingLoose) {
            try { await downloadImage(url, destPath); downloadCount++; console.log(`Downloaded loose: ${castingName} → ${fileName}`); }
            catch (err) { console.error(`Error downloading loose image:`, err); }
          }
          if (!existingLoose && fs.existsSync(destPath)) {
            try {
              await prisma.image.create({ data: { path: relativePath, alt: `${castingName} (Loose)`, variant: { connect: { id: variant.id } } } });
              associatedCount++; console.log(`Associated loose image: ${castingName}`);
            } catch (err) { console.error(`Error associating loose image:`, err); }
          }
        }
      }
    }
  }

  console.log(`\nDownload complete. ${downloadCount} images downloaded, ${associatedCount} images associated.`);
}

main().catch((err) => { console.error('Script error:', err); process.exit(1); }).finally(() => prisma.$disconnect());
