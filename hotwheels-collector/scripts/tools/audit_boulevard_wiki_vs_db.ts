/**
 * Compare Fandom Boulevard year pages with local DB (Toy#/Series#, Mix, casting, color).
 * Uses fetchFandomWikiHtml (403-safe). Supports 2012, 2013, 2020–2026.
 *
 *   npx ts-node scripts/tools/audit_boulevard_wiki_vs_db.ts --year 2024
 *   npx ts-node scripts/tools/audit_boulevard_wiki_vs_db.ts --all
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { normBoulevard, stableBoulevardKey } from '../lib/boulevard-wiki-key.ts';

const prisma = new PrismaClient();

const BOULEVARD_YEARS = [2012, 2013, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

function boulevardWikiUrl(year: number): string {
  return `https://hotwheels.fandom.com/wiki/${year}_Hot_Wheels_Boulevard`;
}

const norm = normBoulevard;

interface WikiRow {
  mix: string;
  toyNumber: string;
  seriesNumber: string | null;
  castingName: string;
  color: string;
}

function extractMixEarly($: cheerio.CheerioAPI, table: cheerio.AnyNode, year: 2012 | 2013): string {
  let mixName = '';
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    mixName = prevHeading.text().trim().replace(/\[\]/g, '').trim();
  }
  if (!mixName) {
    mixName = $(table).find('caption').text().trim().replace(/\[\]/g, '').trim();
  }
  const headerRow = $(table).find('thead tr, tbody tr').first();
  const firstHeader = headerRow.find('th, td').first().text().trim();
  if (firstHeader !== 'Toy #') {
    return '';
  }
  return mixName;
}

function shouldSkipEarlyTable(mixName: string, year: 2012 | 2013): boolean {
  if (!mixName) return true;
  if (/hot.*wheels.*boulevard/i.test(mixName)) return true;
  if (year === 2012 && /30-car.*set/i.test(mixName)) return true;
  return false;
}

function extractMixModern($: cheerio.CheerioAPI, table: cheerio.AnyNode): string {
  let mixName = '';
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim().replace(/\[\]$/, '');
    if (/boxed.*set/i.test(headingText)) return 'Boxed Set';
    const mixMatch = headingText.match(/mix\s*(\d+)/i);
    if (mixMatch) mixName = `Mix ${mixMatch[1]}`;
    else if (/rerelease\s+mix/i.test(headingText)) mixName = 'Rerelease Mix';
  }
  if (!mixName) {
    const caption = $(table).find('caption').text().trim();
    if (/boxed.*set/i.test(caption)) return 'Boxed Set';
    const mixMatch = caption.match(/mix\s*(\d+)/i);
    if (mixMatch) mixName = `Mix ${mixMatch[1]}`;
    else if (/rerelease\s+mix/i.test(caption)) mixName = 'Rerelease Mix';
  }
  return mixName || 'Mix 1';
}

function parseWikiRows(year: number, html: string): WikiRow[] {
  const $ = cheerio.load(html);
  const tables = $('table.wikitable');
  const rows: WikiRow[] = [];
  const isEarly = year === 2012 || year === 2013;

  tables.each((_i, table) => {
    let mixName: string;
    if (isEarly) {
      mixName = extractMixEarly($, table, year as 2012 | 2013);
      if (shouldSkipEarlyTable(mixName, year as 2012 | 2013)) return;
    } else {
      mixName = extractMixModern($, table);
      if (/boxed.*set/i.test(mixName)) return;
    }

    const bodyRows = $(table).find('tbody tr').filter((_j, row) => {
      return $(row).find('td').length >= 3;
    });

    bodyRows.each((_j, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      if (isEarly) {
        const toyNumber = $(cells[0]).text().trim();
        const castingLink = $(cells[1]).find('a').first();
        const castingNameRaw =
          castingLink.length > 0 ? castingLink.text().trim() : $(cells[1]).text().trim();
        const bodyColor = cells.length > 2 ? $(cells[2]).text().trim() : '';
        if (!toyNumber || !castingNameRaw) return;
        rows.push({
          mix: mixName,
          toyNumber,
          seriesNumber: null,
          castingName: castingNameRaw,
          color: bodyColor,
        });
      } else {
        const toyNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
        const seriesNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
        const castingLink = $(cells[2]).find('a').first();
        const castingNameRaw =
          castingLink.length > 0 ? castingLink.text().trim() : $(cells[2]).text().trim();
        const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
        if (!toyNumber || !seriesNumber || !castingNameRaw) return;
        rows.push({
          mix: mixName,
          toyNumber,
          seriesNumber,
          castingName: castingNameRaw,
          color: bodyColor,
        });
      }
    });
  });

  return rows;
}

function wikiRowStableKey(year: number, r: WikiRow): string {
  return stableBoulevardKey(year, r.mix, r.seriesNumber ?? r.toyNumber, r.toyNumber);
}

async function auditYear(year: number): Promise<void> {
  const url = boulevardWikiUrl(year);
  console.log(`\n======== ${year} Boulevard ========`);
  console.log(`URL: ${url}`);

  let html: string;
  try {
    html = await fetchFandomWikiHtml(url);
  } catch (e) {
    console.error(`  Wiki fetch failed: ${e}`);
    return;
  }

  const wikiRows = parseWikiRows(year, html);
  const wikiKeys = new Map<string, WikiRow>();
  for (const r of wikiRows) {
    const k = wikiRowStableKey(year, r);
    if (wikiKeys.has(k)) {
      console.warn(`  Wiki duplicate key: ${k}`);
    }
    wikiKeys.set(k, r);
  }
  console.log(`Wiki: ${wikiRows.length} data rows (${wikiKeys.size} unique keys)`);

  const yearRow = await prisma.year.findFirst({ where: { year } });
  if (!yearRow) {
    console.log('DB: Year missing — variants=0, all wiki rows count as missing in DB');
    console.log(`  Missing in DB: ${wikiKeys.size}`);
    return;
  }

  const col = await prisma.collection.findFirst({
    where: { name: 'Boulevard', yearId: yearRow.id },
  });
  if (!col) {
    console.log('DB: Boulevard collection missing');
    console.log(`  Missing in DB: ${wikiKeys.size}`);
    return;
  }

  const variants = await prisma.variant.findMany({
    where: { year, model: { collectionId: col.id } },
    include: { model: { include: { subSeries: true } } },
  });

  const dbKeys = new Map<
    string,
    { id: number; mix: string; cardNumber: string | null; casting: string; color: string | null; castingId: string | null }
  >();
  for (const v of variants) {
    const mix = v.model.subSeries?.name ?? '';
    const key = stableBoulevardKey(year, mix, v.cardNumber, v.model.castingId ?? v.cardNumber ?? '');
    if (dbKeys.has(key)) {
      console.warn(`  DB duplicate key: ${key}`);
    }
    dbKeys.set(key, {
      id: v.id,
      mix,
      cardNumber: v.cardNumber,
      casting: v.model.castingName,
      color: v.color,
      castingId: v.model.castingId,
    });
  }

  console.log(`DB: ${variants.length} variants (${dbKeys.size} unique mix|card keys)`);

  const missingInDb: string[] = [];
  for (const k of wikiKeys.keys()) {
    if (!dbKeys.has(k)) missingInDb.push(k);
  }

  const extraInDb: string[] = [];
  for (const k of dbKeys.keys()) {
    if (!wikiKeys.has(k)) extraInDb.push(k);
  }

  const mismatches: string[] = [];
  for (const [k, w] of wikiKeys) {
    const d = dbKeys.get(k);
    if (!d) continue;
    if (norm(w.castingName) !== norm(d.casting)) {
      mismatches.push(
        `  ${k}: casting wiki="${w.castingName}" db="${d.casting}" (variant ${d.id})`,
      );
    }
    if (norm(w.color) !== norm(d.color ?? '')) {
      mismatches.push(
        `  ${k}: color wiki="${w.color}" db="${d.color ?? ''}" (variant ${d.id})`,
      );
    }
    if (year >= 2020 && w.toyNumber && d.castingId && norm(w.toyNumber) !== norm(d.castingId)) {
      mismatches.push(
        `  ${k}: Toy# wiki="${w.toyNumber}" model.castingId="${d.castingId}" (variant ${d.id})`,
      );
    }
  }

  console.log(`Missing in DB (wiki has, DB not): ${missingInDb.length}`);
  for (const k of missingInDb.slice(0, 25)) {
    const w = wikiKeys.get(k)!;
    console.log(
      `  ${k} → ${w.castingName} (Toy ${w.toyNumber}${w.seriesNumber != null ? `, Series ${w.seriesNumber}` : ''})`,
    );
  }
  if (missingInDb.length > 25) console.log(`  … ${missingInDb.length - 25} more`);

  console.log(`Extra in DB (not on wiki tables): ${extraInDb.length}`);
  for (const k of extraInDb.slice(0, 25)) {
    const d = dbKeys.get(k)!;
    console.log(`  ${k} → variant ${d.id} ${d.casting} card=${d.cardNumber}`);
  }
  if (extraInDb.length > 25) console.log(`  … ${extraInDb.length - 25} more`);

  console.log(`Field mismatches (same key): ${mismatches.length}`);
  for (const line of mismatches.slice(0, 40)) console.log(line);
  if (mismatches.length > 40) console.log(`  … ${mismatches.length - 40} more`);
}

async function main() {
  const all = process.argv.includes('--all');
  const yIdx = process.argv.indexOf('--year');
  const years: number[] = [];
  if (all) {
    years.push(...BOULEVARD_YEARS);
  } else if (yIdx >= 0 && process.argv[yIdx + 1]) {
    years.push(parseInt(process.argv[yIdx + 1]!, 10));
  } else {
    console.error('Usage: audit_boulevard_wiki_vs_db.ts --year YYYY | --all');
    process.exit(1);
  }

  for (const y of years) {
    if (!BOULEVARD_YEARS.includes(y as (typeof BOULEVARD_YEARS)[number])) {
      console.warn(`Skip unsupported year: ${y}`);
      continue;
    }
    await auditYear(y);
  }
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
