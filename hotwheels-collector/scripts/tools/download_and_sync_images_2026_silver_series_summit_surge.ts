/**
 * Download images for 2026 Summit Surge (Automotive)
 * npx ts-node scripts/tools/download_and_sync_images_2026_silver_series_summit_surge.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const targetYear = 2026;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Summit_Surge_Series_(2026)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Summit Surge (2026)';
const BASE_SUBDIR = 'silver-series/summit-surge';

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

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>) {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = sanitize(cells.length > 1 ? $(cells[1]).text().trim() : '');
  const link = $(cells[2]).find('a').first();
  const castingName = link.length > 0 ? link.text().trim() : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber, colNumber, castingName, color };
}

async function main() {
  console.log('=== SUMMIT SURGE (2026) IMAGE SCRIPT ===');
  const res = await fetch(WIKI_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const $ = cheerio.load(await res.text());
  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error('No tables');

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });
  let dl = 0, assoc = 0;
  const looseIdx = 8, cardedIdx = 9;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|gallery)$/i.test(mixName)) continue;

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 3);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length < 10) continue;

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

        let url = raw.startsWith('//') ? 'https:' + raw : raw;
        url = url.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
        const ext = url.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg';
        const fname = `${toyNumber}_${kind}.${ext}`;
        const dest = path.join(folder, fname);
        const rel = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${slug}/${fname}`;

        if (!fs.existsSync(dest)) {
          try { await download(url, dest); dl++; console.log(`Downloaded ${kind}: ${castingName} → ${fname}`); } catch (e) { console.error(e); }
        }

        const existing = kind === 'loose' ? await prisma.image.findFirst({ where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } } }) : null;
        if (kind === 'carded' && !variant.imageId && fs.existsSync(dest)) {
          try {
            const imgR = await prisma.image.create({ data: { path: rel, alt: `${castingName} (Carded)`, variant: { connect: { id: variant.id } } } });
            await prisma.variant.update({ where: { id: variant.id }, data: { imageId: imgR.id } });
            assoc++; console.log(`Associated carded: ${castingName}`);
          } catch (e) { console.error(e); }
        }
        if (kind === 'loose' && !existing && fs.existsSync(dest)) {
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
