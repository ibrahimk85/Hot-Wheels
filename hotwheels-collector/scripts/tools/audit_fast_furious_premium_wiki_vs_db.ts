/**
 * Compare Fandom Fast & Furious Premium year pages with local DB.
 * Uses fetchFandomWikiHtml (403-safe). Years: 2019–2021, 2023–2026 (no 2022 wiki page in scope).
 *
 *   npx ts-node scripts/tools/audit_fast_furious_premium_wiki_vs_db.ts --year 2024
 *   npx ts-node scripts/tools/audit_fast_furious_premium_wiki_vs_db.ts --all
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import {
  extractFastFuriousPremiumSubSeriesName,
  parsePremiumWikiRowForImport,
} from '../lib/fast-furious-premium-wiki-row.ts';

const prisma = new PrismaClient();

const PREMIUM_YEARS = [2019, 2020, 2021, 2023, 2024, 2025, 2026] as const;

function premiumWikiUrl(year: number): string {
  return `https://hotwheels.fandom.com/wiki/${year}_Fast_%26_Furious_Premium_Series`;
}

function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Wiki headings sometimes leave a trailing "[]" in stored sub-series names. */
function normSubSeriesName(s: string): string {
  return norm(s.replace(/\[\]\s*$/, '').trim());
}

function looksLikeToyNumber(s: string): boolean {
  const t = s.replace(/\s+/g, '');
  return /^[A-Z0-9]{2,8}$/i.test(t) && /\d/.test(t);
}

function looksLikeSeriesNumber(s: string): boolean {
  return /^\d+\/\d+$/.test(s.replace(/\s+/g, ''));
}

/**
 * Older imports sometimes stored Toy# in cardNumber and Col# in model.castingId.
 * Normalize to wiki order: card = series (e.g. 1/5), toy = casting id (e.g. GBW78).
 */
function dbSeriesAndToy(cardNumber: string | null, castingId: string | null): { card: string; toy: string } {
  let card = (cardNumber ?? '').trim();
  let toy = (castingId ?? '').trim();
  if (looksLikeSeriesNumber(card) && looksLikeToyNumber(toy)) {
    return { card, toy };
  }
  if (looksLikeSeriesNumber(toy) && looksLikeToyNumber(card)) {
    return { card: toy, toy: card };
  }
  return { card, toy };
}

function shouldSkipTable(subSeriesName: string, year: number): boolean {
  if (/^(contents|references|see also|external links|categories|boxed set)$/i.test(subSeriesName)) {
    return true;
  }
  if (/tokyo drift bundle/i.test(subSeriesName)) {
    return true;
  }
  if (year >= 2023 && year <= 2025) {
    if (
      /fast.*furious.*premium.*bundle.*[123]/i.test(subSeriesName) ||
      /^bundle\s*[123]$/i.test(subSeriesName)
    ) {
      return true;
    }
  }
  return false;
}

interface WikiRow {
  subSeries: string;
  toyNumber: string;
  cardNumber: string;
  castingName: string;
  color: string;
}

function stableKeyFromParts(subSeries: string, cardNumber: string, toyNumber: string, color: string): string {
  return `${normSubSeriesName(subSeries)}|${norm(cardNumber)}|${norm(toyNumber)}|${norm(color)}`;
}

function stableKeyWikiRow(r: WikiRow): string {
  return stableKeyFromParts(r.subSeries, r.cardNumber, r.toyNumber, r.color);
}

function parseWikiRows(year: number, html: string): WikiRow[] {
  const $ = cheerio.load(html);
  const out: WikiRow[] = [];

  $('table.wikitable').each((_i, table) => {
    const subSeriesName = extractFastFuriousPremiumSubSeriesName($, table);
    if (shouldSkipTable(subSeriesName, year)) {
      return;
    }

    $(table)
      .find('tbody tr')
      .filter((_j, row) => $(row).find('td').length >= 3)
      .each((_j, row) => {
        const cells = $(row).find('td');
        const parsed = parsePremiumWikiRowForImport($, cells);
        if (!parsed.toyNumber || !parsed.collectorNumber || !parsed.castingName) {
          return;
        }
        out.push({
          subSeries: subSeriesName,
          toyNumber: parsed.toyNumber,
          cardNumber: parsed.collectorNumber,
          castingName: parsed.castingName,
          color: parsed.bodyColor.trim(),
        });
      });
  });

  return out;
}

async function auditYear(year: number): Promise<void> {
  const url = premiumWikiUrl(year);
  console.log(`\n======== ${year} Fast & Furious Premium ========`);
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
    const k = stableKeyWikiRow(r);
    if (wikiKeys.has(k)) {
      console.warn(`  Wiki duplicate key: ${k}`);
    }
    wikiKeys.set(k, r);
  }
  console.log(`Wiki: ${wikiRows.length} data rows (${wikiKeys.size} unique keys)`);

  const yearRow = await prisma.year.findFirst({ where: { year } });
  if (!yearRow) {
    console.log('DB: Year missing');
    console.log(`  Missing in DB: ${wikiKeys.size}`);
    return;
  }

  const col = await prisma.collection.findFirst({
    where: { name: 'Fast & Furious Premium', yearId: yearRow.id },
  });
  if (!col) {
    console.log('DB: Fast & Furious Premium collection missing');
    console.log(`  Missing in DB: ${wikiKeys.size}`);
    return;
  }

  const variants = await prisma.variant.findMany({
    where: { year, model: { collectionId: col.id } },
    include: { model: { include: { subSeries: true } } },
  });

  const dbKeys = new Map<
    string,
    {
      id: number;
      subSeries: string;
      cardNumber: string | null;
      casting: string;
      color: string | null;
      castingId: string | null;
    }
  >();

  for (const v of variants) {
    const subSeries = v.model.subSeries?.name ?? '';
    const color = (v.color ?? '').trim();
    const { card, toy } = dbSeriesAndToy(v.cardNumber, v.model.castingId);
    const k = stableKeyFromParts(subSeries, card, toy, color);
    if (dbKeys.has(k)) {
      console.warn(`  DB duplicate key: ${k}`);
    }
    dbKeys.set(k, {
      id: v.id,
      subSeries,
      cardNumber: v.cardNumber,
      casting: v.model.castingName,
      color: v.color,
      castingId: v.model.castingId,
    });
  }

  console.log(`DB: ${variants.length} variants (${dbKeys.size} unique keys)`);

  const missingInDb: string[] = [];
  for (const k of wikiKeys.keys()) {
    if (!dbKeys.has(k)) {
      missingInDb.push(k);
    }
  }

  const extraInDb: string[] = [];
  for (const k of dbKeys.keys()) {
    if (!wikiKeys.has(k)) {
      extraInDb.push(k);
    }
  }

  const mismatches: string[] = [];
  for (const [k, w] of wikiKeys) {
    const d = dbKeys.get(k);
    if (!d) {
      continue;
    }
    if (norm(w.castingName) !== norm(d.casting)) {
      mismatches.push(`  ${k}: casting wiki="${w.castingName}" db="${d.casting}" (variant ${d.id})`);
    }
    if (norm(w.color) !== norm(d.color ?? '')) {
      mismatches.push(`  ${k}: color wiki="${w.color}" db="${d.color ?? ''}" (variant ${d.id})`);
    }
    const dbToy = dbSeriesAndToy(d.cardNumber, d.castingId).toy;
    if (w.toyNumber && dbToy && norm(w.toyNumber) !== norm(dbToy)) {
      mismatches.push(
        `  ${k}: Toy# wiki="${w.toyNumber}" db toy field="${dbToy}" (variant ${d.id})`,
      );
    }
  }

  console.log(`Missing in DB (wiki has, DB not): ${missingInDb.length}`);
  for (const k of missingInDb.slice(0, 25)) {
    const w = wikiKeys.get(k)!;
    console.log(`  ${k} → ${w.castingName} (Toy ${w.toyNumber}, Series ${w.cardNumber})`);
  }
  if (missingInDb.length > 25) {
    console.log(`  … ${missingInDb.length - 25} more`);
  }

  console.log(`Extra in DB (not matched to wiki rows): ${extraInDb.length}`);
  for (const k of extraInDb.slice(0, 25)) {
    const d = dbKeys.get(k)!;
    console.log(`  ${k} → variant ${d.id} ${d.casting} card=${d.cardNumber}`);
  }
  if (extraInDb.length > 25) {
    console.log(`  … ${extraInDb.length - 25} more`);
  }

  console.log(`Field mismatches (same key): ${mismatches.length}`);
  for (const line of mismatches.slice(0, 40)) {
    console.log(line);
  }
  if (mismatches.length > 40) {
    console.log(`  … ${mismatches.length - 40} more`);
  }
}

async function main() {
  const all = process.argv.includes('--all');
  const yIdx = process.argv.indexOf('--year');
  const years: number[] = [];
  if (all) {
    years.push(...PREMIUM_YEARS);
  } else if (yIdx >= 0 && process.argv[yIdx + 1]) {
    years.push(parseInt(process.argv[yIdx + 1]!, 10));
  } else {
    console.error('Usage: audit_fast_furious_premium_wiki_vs_db.ts --year YYYY | --all');
    process.exit(1);
  }

  for (const y of years) {
    if (!PREMIUM_YEARS.includes(y as (typeof PREMIUM_YEARS)[number])) {
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
