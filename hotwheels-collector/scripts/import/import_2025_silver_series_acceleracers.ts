/**
 * Import 2025 Hot Wheels Silver Series - AcceleRacers (Entertainment category)
 * Supports 8-col and 10-col tables
 * npx ts-node scripts/import/import_2025_silver_series_acceleracers.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2025;
const URL = 'https://hotwheels.fandom.com/wiki/AcceleRacers_Series_(2025)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'AcceleRacers (2025)';
const CATEGORY = 'Entertainment';

const prisma = new PrismaClient();

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchModelMetadata(url: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
    const $ = cheerio.load(await res.text());
    let debut: string | null = null, produced: string | null = null, designer: string | null = null, num: string | null = null, desc: string | null = null;
    $('.infobox, .wikitable').first().find('tr').each((_: any, row: any) => {
      const c = $(row).find('td, th');
      if (c.length >= 2) {
        const l = $(c[0]).text().trim().toLowerCase(), v = $(c[1]).text().trim();
        if (/debut|first/i.test(l)) debut = v || null;
        if (/produced|years/i.test(l)) produced = v || null;
        if (/designer/i.test(l)) designer = v || null;
        if (/number|casting/i.test(l)) num = v || null;
      }
    });
    const p = $('p').first().text().trim();
    if (p && p.length > 20) desc = p;
    return { debutSeries: debut, produced, designer, castingNumber: num, description: desc };
  } catch {
    return { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
  }
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
  const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
  const link = $(cells[2]).find('a').first();
  const castingName = link.length > 0 ? link.text().trim() : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  const wheelType = cells.length >= 10 ? (cells.length > 6 ? $(cells[6]).text().trim() : '') : (cells.length > 5 ? $(cells[5]).text().trim() : '');
  const notes = cells.length >= 10 ? (cells.length > 7 ? $(cells[7]).text().trim() : '') : (cells.length > 6 ? $(cells[6]).text().trim() : '');
  return { colNumber, toyNumber, castingName, color, wheelType, notes, castingNameLink: link };
}

async function main() {
  console.log(`Fetching AcceleRacers (${targetYear}) from ${URL}…`);
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const $ = cheerio.load(await res.text());
  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error('No tables found');

  let yearRec = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRec) { yearRec = await prisma.year.create({ data: { year: targetYear } }); }

  let collRec = await prisma.collection.findFirst({ where: { name: COLLECTION_NAME, yearId: yearRec.id } });
  if (!collRec) {
    collRec = await prisma.collection.create({
      data: { name: COLLECTION_NAME, code: 'Silver Series', year: { connect: { id: yearRec.id } } },
    });
  }

  const subCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const metaCache = new Map<string, any>();
  let created = 0;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|gallery)$/i.test(mixName)) continue;

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 3);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length < 8) continue;

      const p = parseRow($, cells);
      if (!p.toyNumber || !p.castingName) continue;

      let sub = subCache.get(subName);
      if (!sub) {
        const ex = await prisma.subSeries.findFirst({ where: { name: subName, collectionId: collRec!.id } });
        if (ex) sub = { id: ex.id };
        else {
          const cr = await prisma.subSeries.create({
            data: { name: subName, category: CATEGORY, collection: { connect: { id: collRec!.id } } },
          });
          sub = { id: cr.id };
          console.log(`Created SubSeries: ${subName}`);
        }
        subCache.set(subName, sub);
      }

      const modelKey = `${p.castingName}_${subName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const exM = await prisma.model.findFirst({ where: { castingName: p.castingName, subSeriesId: sub.id } });
        if (exM) model = { id: exM.id };
        else {
          let meta = metaCache.get(p.castingName);
          if (!meta) {
            const href = p.castingNameLink.attr('href');
            if (href) {
              const u = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
              console.log(`Fetching metadata for ${p.castingName}...`);
              meta = await fetchModelMetadata(u);
              metaCache.set(p.castingName, meta);
              await sleep(500);
            } else meta = { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
          }
          const c = await prisma.model.create({
            data: {
              castingName: p.castingName, toyNumber: p.toyNumber,
              description: meta.description, debutSeries: meta.debutSeries, produced: meta.produced, designer: meta.designer, castingNumber: meta.castingNumber,
              collection: { connect: { id: collRec!.id } }, subSeries: { connect: { id: sub.id } },
            },
          });
          model = { id: c.id };
          console.log(`Created Model: ${p.castingName}`);
        }
        modelCache.set(modelKey, model);
      }

      if (await prisma.variant.findFirst({ where: { modelId: model!.id, cardNumber: p.colNumber || undefined, color: p.color || undefined, year: targetYear } })) continue;

      await prisma.variant.create({
        data: {
          model: { connect: { id: model!.id } }, year: targetYear, releaseName: subName,
          color: p.color || undefined, cardNumber: p.colNumber || undefined, toyNumber: p.toyNumber, wheelType: p.wheelType || undefined,
          isTreasureHunt: false, isSuperTreasureHunt: false, notes: p.notes || undefined, quantity: 0,
        },
      });
      created++;
    }
  }

  console.log(`Import completed. Created ${created} new variants.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
