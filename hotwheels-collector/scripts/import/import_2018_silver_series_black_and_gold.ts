/**
 * Script to import the 2018 Hot Wheels Silver Series - Black and Gold 50th Anniversary set into your database.
 *
 * Fetches from: https://hotwheels.fandom.com/wiki/50th_Anniversary_Black_and_Gold_Series_(2018)
 * Creates: Year → Collection (Hot Wheels Silver Series) → SubSeries (category=Anniversary) → Model → Variant
 * Series name: Black and Gold 50th Anniversary Series (2018)
 *
 * How to use:
 *   npx ts-node scripts/import/import_2018_silver_series_black_and_gold.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2018;
const URL = 'https://hotwheels.fandom.com/wiki/50th_Anniversary_Black_and_Gold_Series_(2018)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Black and Gold 50th Anniversary Series (2018)';
const CATEGORY = 'Anniversary';

const prisma = new PrismaClient();

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchModelMetadata(modelUrl: string): Promise<{
  debutSeries: string | null; produced: string | null; designer: string | null; castingNumber: string | null; description: string | null;
}> {
  try {
    const res = await fetch(modelUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
    const $ = cheerio.load(await res.text());
    let debutSeries: string | null = null, produced: string | null = null, designer: string | null = null, castingNumber: string | null = null, description: string | null = null;
    $('.infobox, .wikitable').first().find('tr').each((_: any, row: any) => {
      const cells = $(row).find('td, th');
      if (cells.length >= 2) {
        const l = $(cells[0]).text().trim().toLowerCase(), v = $(cells[1]).text().trim();
        if (/debut|first.*appear/i.test(l)) debutSeries = v || null;
        if (/produced|years/i.test(l)) produced = v || null;
        if (/designer/i.test(l)) designer = v || null;
        if (/number|casting.*number/i.test(l)) castingNumber = v || null;
      }
    });
    const d = $('p').first().text().trim();
    if (d && d.length > 20) description = d;
    return { debutSeries, produced, designer, castingNumber, description };
  } catch {
    return { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
  }
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  const prev = $(table).prevAll('h2, h3, h4').first();
  if (prev.length > 0) {
    const t = prev.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(t)) return t;
  }
  return $(table).find('caption').text().trim().replace(/\[\]$/, '') || 'Mix 1';
}

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>): {
  colNumber: string; toyNumber: string; castingName: string; color: string; wheelType: string; notes: string; castingNameLink: ReturnType<typeof $>;
} {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0 ? castingNameLink.text().trim() : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  const wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
  const notes = cells.length > 6 ? $(cells[6]).text().trim() : '';
  return { colNumber, toyNumber, castingName, color, wheelType, notes, castingNameLink };
}

async function main() {
  console.log(`Fetching Black and Gold 50th Anniversary Series (${targetYear}) from ${URL}…`);
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
  if (!res.ok) throw new Error(`Failed to fetch ${URL}: ${res.status}`);
  const $ = cheerio.load(await res.text());
  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s). Processing…`);
  if (tables.length === 0) throw new Error(`Could not find any tables on ${URL}`);

  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) { yearRecord = await prisma.year.create({ data: { year: targetYear } }); console.log(`Created Year ${targetYear}`); }

  let collectionRecord = await prisma.collection.findFirst({ where: { name: COLLECTION_NAME, yearId: yearRecord.id } });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: { name: COLLECTION_NAME, code: 'Silver Series', year: { connect: { id: yearRecord.id } } },
    });
    console.log(`Created Collection ${COLLECTION_NAME}`);
  }

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const metadataCache = new Map<string, any>();
  let totalProcessed = 0, totalCreated = 0;

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const mixName = extractMixName($, table);
    const subSeriesName = `${SERIES_NAME} - ${mixName}`;
    if (/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(mixName)) { console.log(`Skipping: ${mixName}`); continue; }
    console.log(`\nProcessing ${subSeriesName}…`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => $(row).find('td').length >= 3);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length < 3) continue;

      const parsed = parseRow($, cells);
      if (!parsed.toyNumber || !parsed.castingName) { console.warn(`Skipping: Toy#=${parsed.toyNumber}, Name=${parsed.castingName}`); continue; }
      const { colNumber, toyNumber, castingName, color, wheelType, notes, castingNameLink } = parsed;

      let subSeries = subSeriesCache.get(subSeriesName);
      if (!subSeries) {
        const ex = await prisma.subSeries.findFirst({ where: { name: subSeriesName, collectionId: collectionRecord!.id } });
        if (ex) subSeries = { id: ex.id };
        else {
          const c = await prisma.subSeries.create({ data: { name: subSeriesName, category: CATEGORY, collection: { connect: { id: collectionRecord!.id } } } });
          console.log(`Created SubSeries: ${subSeriesName} (category: ${CATEGORY})`);
          subSeries = { id: c.id };
        }
        subSeriesCache.set(subSeriesName, subSeries);
      }

      const modelKey = `${castingName}_${subSeriesName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const exModel = await prisma.model.findFirst({ where: { castingName, subSeriesId: subSeries.id } });
        if (exModel) model = { id: exModel.id };
        else {
          let meta = metadataCache.get(castingName);
          if (!meta) {
            const href = castingNameLink.attr('href');
            if (href) {
              const u = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
              console.log(`Fetching metadata for ${castingName}...`);
              meta = await fetchModelMetadata(u);
              metadataCache.set(castingName, meta);
              await sleep(500);
            } else meta = { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
          }
          const c = await prisma.model.create({
            data: {
              castingName, toyNumber, description: meta.description, debutSeries: meta.debutSeries, produced: meta.produced, designer: meta.designer, castingNumber: meta.castingNumber,
              collection: { connect: { id: collectionRecord!.id } }, subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: c.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      const exVar = await prisma.variant.findFirst({
        where: { modelId: model.id, cardNumber: colNumber || undefined, color: color || undefined, year: targetYear },
      });
      if (exVar) continue;

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } }, year: targetYear, releaseName: subSeriesName,
          color: color || undefined, cardNumber: colNumber || undefined, toyNumber, wheelType: wheelType || undefined,
          isTreasureHunt: false, isSuperTreasureHunt: false, notes: notes || undefined, quantity: 0,
        },
      });
      totalCreated++;
      totalProcessed++;
    }
  }

  console.log(`\nImport completed. Processed ${totalProcessed} rows, created ${totalCreated} new variants.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
