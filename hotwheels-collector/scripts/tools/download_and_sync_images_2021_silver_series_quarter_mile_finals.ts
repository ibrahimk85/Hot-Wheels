/**
 * Download images for 2021 1/4 Mile Finals (Automotive) - 12-col table
 * npx ts-node scripts/tools/download_and_sync_images_2021_silver_series_quarter_mile_finals.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const targetYear = 2021;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/1/4_Mile_Finals_Series_(2021)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = '1/4 Mile Finals (2021)';
const BASE_SUBDIR = 'silver-series/quarter-mile-finals';

function sanitize(s: string) { return s.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim(); }
function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

async function download(url: string, dest: string) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await fs.promises.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  const prev = $(table).prevAll('h2, h3, h4').first();
  if (prev.length > 0) {
    const t = prev.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|gallery)$/i.test(t)) return t;
  }
  return $(table).find('caption').text().trim().replace(/\[\]$/, '') || 'Vehicles';
}

/** 12-col: Series # | Casting Name | Toy # | Color | ... | Photo Loose | Photo Card */
function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>) {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = sanitize(cells.length > 2 ? $(cells[2]).text().trim() : '');
  const link = $(cells[1]).find('a').first();
  const castingName = link.length > 0 ? link.text().trim() : cells.length > 1 ? $(cells[1]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber, colNumber, castingName, color };
}

async function main() {
  console.log('=== 1/4 MILE FINALS (2021) IMAGE SCRIPT ===');
  const res = await fetch(WIKI_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const $ = cheerio.load(await res.text());
  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error('No tables');

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });
  let dl = 0, assoc = 0;
  const looseIdx = 10, cardedIdx = 11;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|gallery)$/i.test(mixName)) continue;

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 3);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length < 12) continue;

      const { toyNumber, colNumber, castingName, color } = parseRow($, cells);
      if (!toyNumber || !castingName) continue;

      const model = await prisma.model.findFirst({
        where: { castingName, subSeries: { name: subName, collection: { name: COLLECTION_NAME, year: { year: targetYear } } } },
      });
      if (!model) continue;

      const vWhere: any = { modelId: model.id, cardNumber: colNumber || undefined, year: targetYear };
      vWhere.color = color?.trim() ? color.trim() : null;
      const variant = await prisma.variant.findFirst({ where: vWhere });
      if (!variant) continue;

      const slug = slugify(castingName);
      const folder = path.join(baseDir, slug);
      await fs.promises.mkdir(folder, { recursive: true });

      for (const [idx, kind] of [[cardedIdx, 'carded'] as const, [looseIdx, 'loose'] as const]) {
        const img = $(cells[idx]).find('img').first();
        const raw = img.attr('data-src') || img.attr('src');
        if (!raw || raw.includes('Image_Not_Available')) continue;

        let imgUrl = raw.startsWith('//') ? 'https:' + raw : raw;
        imgUrl = imgUrl.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
        const ext = imgUrl.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg';
        const fname = `${toyNumber}_${kind}.${ext}`;
        const destPath = path.join(folder, fname);
        const rel = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${slug}/${fname}`;

        if (!fs.existsSync(destPath)) {
          try { await download(imgUrl, destPath); dl++; console.log(`Downloaded ${kind}: ${castingName} -> ${fname}`); } catch (e) { console.error(e); }
        }

        const existing = kind === 'loose' ? await prisma.image.findFirst({ where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } } }) : null;
        if (kind === 'carded' && !variant.imageId && fs.existsSync(destPath)) {
          try {
            const imgR = await prisma.image.create({ data: { path: rel, alt: `${castingName} (Carded)`, variant: { connect: { id: variant.id } } } });
            await prisma.variant.update({ where: { id: variant.id }, data: { imageId: imgR.id } });
            assoc++; console.log(`Associated carded: ${castingName}`);
          } catch (e) { console.error(e); }
        }
        if (kind === 'loose' && !existing && fs.existsSync(destPath)) {
          try {
            await prisma.image.create({ data: { path: rel, alt: `${castingName} (Loose)`, variant: { connect: { id: variant.id } } } });
            assoc++; console.log(`Associated loose: ${castingName}`);
          } catch (e) { console.error(e); }
        }
      }
    }
  }

  console.log(`\nDone. ${dl} downloaded, ${assoc} associated.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
