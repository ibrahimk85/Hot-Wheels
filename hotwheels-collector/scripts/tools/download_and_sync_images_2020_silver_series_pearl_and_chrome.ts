/**
 * Script to download image assets for 2020 Hot Wheels Silver Series - Pearl and Chrome.
 *
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2020_silver_series_pearl_and_chrome.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2020;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Pearl_and_Chrome_Series_(2020)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Pearl and Chrome (2020)';
const BASE_SUBDIR = 'silver-series/pearl-and-chrome';

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
    const t = prev.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(t)) return t;
  }
  return $(table).find('caption').text().trim().replace(/\[\]$/, '') || 'Mix 1';
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
  console.log('=== PEARL AND CHROME (2020) IMAGE DOWNLOAD SCRIPT ===');
  console.log(`URL: ${WIKI_URL}`);

  const resp = await fetch(WIKI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${WIKI_URL}: ${resp.status}`);
  const $ = cheerio.load(await resp.text());
  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not locate any tables on ${WIKI_URL}`);

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });
  let downloadCount = 0, associatedCount = 0;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subSeriesName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(mixName)) { console.log(`Skipping: ${mixName}`); continue; }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => $(row).find('td').length >= 3);
    console.log(`Processing ${rows.length} rows from ${subSeriesName}…`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length < 3) continue;

      const { toyNumber, colNumber, castingName, color } = parseRow($, cells);
      if (!toyNumber || !castingName) continue;

      const model = await prisma.model.findFirst({
        where: {
          castingName,
          subSeries: { name: subSeriesName, collection: { name: COLLECTION_NAME, year: { year: targetYear } } },
        },
      });
      if (!model) { console.warn(`Model not found: ${castingName}`); continue; }

      const variantWhere: any = { modelId: model.id, cardNumber: colNumber || undefined, year: targetYear };
      variantWhere.color = color && color.trim() !== '' ? color.trim() : null;
      const variant = await prisma.variant.findFirst({ where: variantWhere });
      if (!variant) { console.warn(`Variant not found: ${castingName} #${colNumber}`); continue; }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });
      const looseColIdx = 7, cardedColIdx = 8;

      if (cells.length > cardedColIdx) {
        const img = $(cells[cardedColIdx]).find('img').first();
        const urlRaw = img.attr('data-src') || img.attr('src');
        if (urlRaw && !urlRaw.includes('Image_Not_Available')) {
          let url = urlRaw.startsWith('//') ? 'https:' + urlRaw : urlRaw;
          url = url.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const ext = url.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg';
          const fileName = `${toyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;

          if (!fs.existsSync(destPath)) {
            try { await downloadImage(url, destPath); downloadCount++; console.log(`Downloaded carded: ${castingName} → ${fileName}`); }
            catch (e) { console.error(`Error downloading carded:`, e); }
          }
          if (!variant.imageId && fs.existsSync(destPath)) {
            try {
              const imgRec = await prisma.image.create({ data: { path: relativePath, alt: `${castingName} (Carded)`, variant: { connect: { id: variant.id } } } });
              await prisma.variant.update({ where: { id: variant.id }, data: { imageId: imgRec.id } });
              associatedCount++; console.log(`Associated carded: ${castingName}`);
            } catch (e) { console.error(`Error associating carded:`, e); }
          }
        }
      }

      if (cells.length > looseColIdx) {
        const img = $(cells[looseColIdx]).find('img').first();
        const urlRaw = img.attr('data-src') || img.attr('src');
        if (urlRaw && !urlRaw.includes('Image_Not_Available')) {
          let url = urlRaw.startsWith('//') ? 'https:' + urlRaw : urlRaw;
          url = url.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const ext = url.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg';
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);
          const relativePath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;
          const exLoose = await prisma.image.findFirst({ where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } } });

          if (!fs.existsSync(destPath) && !exLoose) {
            try { await downloadImage(url, destPath); downloadCount++; console.log(`Downloaded loose: ${castingName} → ${fileName}`); }
            catch (e) { console.error(`Error downloading loose:`, e); }
          }
          if (!exLoose && fs.existsSync(destPath)) {
            try {
              await prisma.image.create({ data: { path: relativePath, alt: `${castingName} (Loose)`, variant: { connect: { id: variant.id } } } });
              associatedCount++; console.log(`Associated loose: ${castingName}`);
            } catch (e) { console.error(`Error associating loose:`, e); }
          }
        }
      }
    }
  }

  console.log(`\nDownload complete. ${downloadCount} images downloaded, ${associatedCount} images associated.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
