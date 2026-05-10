/**
 * Download images for Celebrations 2021-2025 series
 * npx ts-node scripts/tools/download_and_sync_images_celebrations_2021_2025.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// tableLayout: 'standard' = Series#|Toy#|Casting|Color|...|Loose|Carded
// tableLayout: 'factory500' = Series#|Casting|Toy#|Color|Tampo|Base|Window|Interior|Wheel|Notes|Loose|Card (12 cols)
const SERIES_CONFIG: Array<{ url: string; year: number; seriesName: string; subdir: string; tableLayout?: 'standard' | 'factory500' }> = [
  { url: 'https://hotwheels.fandom.com/wiki/Mustang_60_Years_Series_(2025)', year: 2025, seriesName: 'Celebrations - Mustang 60 Years (2025)', subdir: 'mustang-60-years' },
  { url: 'https://hotwheels.fandom.com/wiki/BMW_Series_(2025)', year: 2025, seriesName: 'Celebrations - BMW (2025)', subdir: 'bmw' },
  { url: 'https://hotwheels.fandom.com/wiki/Porsche_Series_(2024)', year: 2024, seriesName: 'Celebrations - Porsche (2024)', subdir: 'porsche' },
  { url: 'https://hotwheels.fandom.com/wiki/Stars_%26_Stripes_Series_(2024)', year: 2024, seriesName: 'Celebrations - Stars & Stripes (2024)', subdir: 'stars-stripes' },
  { url: 'https://hotwheels.fandom.com/wiki/Corvette_70_Series_(2023)', year: 2023, seriesName: 'Celebrations - Corvette 70 (2023)', subdir: 'corvette-70' },
  { url: 'https://hotwheels.fandom.com/wiki/American_Steel_Series_(2023)', year: 2023, seriesName: 'Celebrations - American Steel (2023)', subdir: 'american-steel' },
  { url: 'https://hotwheels.fandom.com/wiki/HW_Stars_%26_Stripes_Series_(2022)', year: 2022, seriesName: 'Celebrations - HW Stars & Stripes (2022)', subdir: 'hw-stars-stripes' },
  { url: 'https://hotwheels.fandom.com/wiki/Volkswagen_Series_(2022)', year: 2022, seriesName: 'Celebrations - Volkswagen (2022)', subdir: 'volkswagen' },
  { url: 'https://hotwheels.fandom.com/wiki/Factory_500_H.P._Series_(2021)', year: 2021, seriesName: 'Celebrations - Factory 500 H.P. (2021)', subdir: 'factory-500-hp', tableLayout: 'factory500' },
  { url: 'https://hotwheels.fandom.com/wiki/Convertibles_Series_(2021)', year: 2021, seriesName: 'Celebrations - Convertibles (2021)', subdir: 'convertibles' },
];

const COLLECTION_NAME = 'Hot Wheels Silver Series';

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

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>, layout: 'standard' | 'factory500' = 'standard') {
  if (layout === 'factory500') {
    // Series#|Casting|Toy#|Color|Tampo|Base|Window|Interior|Wheel|Notes|Loose|Card
    const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
    const link = $(cells[1]).find('a').first();
    const castingName = link.length > 0 ? link.text().trim() : cells.length > 1 ? $(cells[1]).text().trim() : '';
    const toyNumber = sanitize(cells.length > 2 ? $(cells[2]).text().trim() : '');
    const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
    // For Factory 500: import used wrong cols, so model.castingName = Toy# (GRT02). Match by toyNumber.
    return { toyNumber, colNumber, castingName, color, matchByToyNumber: true };
  }
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = sanitize(cells.length > 1 ? $(cells[1]).text().trim() : '');
  const link = $(cells[2]).find('a').first();
  const castingName = link.length > 0 ? link.text().trim() : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  return { toyNumber: toyNumber || colNumber || '', colNumber, castingName, color, matchByToyNumber: false };
}

function getImageIndices(n: number, layout: 'standard' | 'factory500' = 'standard') {
  if (layout === 'factory500' && n >= 12) return { loose: 10, carded: 11 };
  if (n >= 10) return { loose: 8, carded: 9 };
  if (n >= 9) return { loose: 7, carded: 8 };
  if (n >= 8) return { loose: 6, carded: 7 };
  return null;
}

async function processSeries(config: typeof SERIES_CONFIG[0]) {
  const { url, year: targetYear, seriesName, subdir, tableLayout = 'standard' } = config;
  console.log(`\n=== ${seriesName} ===`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status}`);
    return { dl: 0, assoc: 0 };
  }
  const $ = cheerio.load(await res.text());
  const tables = $('table.wikitable');
  if (tables.length === 0) return { dl: 0, assoc: 0 };

  const BASE_SUBDIR = `silver-series/celebrations/${subdir}`;
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), BASE_SUBDIR.replace(/\//g, path.sep));
  await fs.promises.mkdir(baseDir, { recursive: true });
  let dl = 0, assoc = 0;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subName = `${seriesName} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|gallery)$/i.test(mixName)) continue;

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 5);
    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      const idxs = getImageIndices(cells.length, tableLayout);
      if (!idxs || cells.length < 6) continue;

      const parsed = parseRow($, cells, tableLayout);
      const { toyNumber, colNumber, castingName, color, matchByToyNumber } = parsed;
      const toyNum = toyNumber || colNumber || '';
      if (!castingName && !toyNum) continue;

      // Factory 500: import stored Toy# (GRT02) as castingName; match by it
      const modelWhere = matchByToyNumber
        ? { castingName: toyNum, subSeries: { name: subName, collection: { name: COLLECTION_NAME, year: { year: targetYear } } } }
        : { castingName, subSeries: { name: subName, collection: { name: COLLECTION_NAME, year: { year: targetYear } } } };
      const model = await prisma.model.findFirst({
        where: modelWhere,
      });
      if (!model) continue;

      const vWhere: any = { modelId: model.id, year: targetYear };
      if (colNumber) vWhere.cardNumber = colNumber;
      if (color?.trim()) vWhere.color = color.trim();
      const variant = await prisma.variant.findFirst({ where: vWhere });
      if (!variant) continue;

      const slug = slugify(castingName);
      const folder = path.join(baseDir, slug);
      await fs.promises.mkdir(folder, { recursive: true });

      const imgToyNum = toyNum || colNumber || slug;
      for (const [idx, kind] of [[idxs.carded, 'carded'] as const, [idxs.loose, 'loose'] as const]) {
        const img = $(cells[idx]).find('img').first();
        const raw = img.attr('data-src') || img.attr('src');
        if (!raw || raw.includes('Image_Not_Available')) continue;

        let imgUrl = raw.startsWith('//') ? 'https:' + raw : raw;
        imgUrl = imgUrl.replace(/\/scale-to-width-down\/\d+/g, '').replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
        const ext = imgUrl.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg';
        const fname = `${imgToyNum}_${kind}.${ext}`.replace(/[<>:"/\\|?*]/g, '');
        const destPath = path.join(folder, fname);
        const rel = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${slug}/${fname}`.replace(/\/+/g, '/');

        if (!fs.existsSync(destPath)) {
          try {
            await download(imgUrl, destPath);
            dl++;
            console.log(`  Downloaded ${kind}: ${castingName} -> ${fname}`);
          } catch (e) { console.error('  ', e); }
        }

        const existing = kind === 'loose' ? await prisma.image.findFirst({ where: { variantId: variant.id, path: { contains: `_loose` } } }) : null;
        if (kind === 'carded' && !variant.imageId && fs.existsSync(destPath)) {
          try {
            const imgR = await prisma.image.create({ data: { path: rel, alt: `${castingName} (Carded)`, variant: { connect: { id: variant.id } } } });
            await prisma.variant.update({ where: { id: variant.id }, data: { imageId: imgR.id } });
            assoc++;
            console.log(`  Associated carded: ${castingName}`);
          } catch (e) { console.error('  ', e); }
        }
        if (kind === 'loose' && !existing && fs.existsSync(destPath)) {
          try {
            await prisma.image.create({ data: { path: rel, alt: `${castingName} (Loose)`, variant: { connect: { id: variant.id } } } });
            assoc++;
            console.log(`  Associated loose: ${castingName}`);
          } catch (e) { console.error('  ', e); }
        }
      }
    }
  }
  return { dl, assoc };
}

async function main() {
  let totalDl = 0, totalAssoc = 0;
  for (const config of SERIES_CONFIG) {
    const { dl, assoc } = await processSeries(config);
    totalDl += dl;
    totalAssoc += assoc;
  }
  console.log(`\nDone. ${totalDl} downloaded, ${totalAssoc} associated.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
