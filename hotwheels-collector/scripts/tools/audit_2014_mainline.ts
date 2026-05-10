/**
 * Deep audit for 2014 Mainline: wiki vs DB, integrity checks, and signs of
 * mistaken imports (e.g. 2015 markers or 2015-only sub-series names on 2014).
 *
 *   npx ts-node scripts/tools/audit_2014_mainline.ts
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();

const URL_2014 = 'https://hotwheels.fandom.com/wiki/List_of_2014_Hot_Wheels';
const URL_2015 = 'https://hotwheels.fandom.com/wiki/List_of_2015_Hot_Wheels';

function normalizeSubSeriesLabel(s: string): string {
  return s
    .trim()
    .replace(/\s*New for 20\d{2}!\s*/gi, ' ')
    .replace(/\s*New for 20\d{2}\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function wikiTableSubSeriesNames(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];
  const allTables = $('table');

  allTables.each((index, tableElement) => {
    const $table = $(tableElement);
    let heading: string | null = null;
    let currentElement = $table.prev();
    for (let i = 0; i < 5; i++) {
      if (currentElement.length === 0) break;
      const tagName = currentElement[0]?.tagName?.toLowerCase();
      if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        heading = currentElement.text().trim();
        break;
      }
      currentElement = currentElement.prev();
    }

    let subSeriesName = heading || `Table ${index + 1}`;
    const rows = $table.find('tbody tr, tr');
    if (rows.length < 2) return;

    const firstDataRow = rows.eq(1);
    const cells = firstDataRow.find('td');
    if (cells.length >= 4) {
      const seriesCell = cells.eq(3).text().trim();
      if (seriesCell && seriesCell.length > 0) {
        subSeriesName = seriesCell
          .replace(/\s*\(?\s*Treasure Hunt\s*\)?/gi, '')
          .replace(/\s*\(?\s*Super Treasure Hunt\s*\)?/gi, '')
          .replace(/\s*Super\s*$/gi, '')
          .trim();
      }
    }
    if (!subSeriesName || subSeriesName === `Table ${index + 1}`) {
      subSeriesName = heading || `Table ${index + 1}`;
    }
    names.push(subSeriesName);
  });

  return names;
}

function wikiRowCountEstimate(html: string): number {
  const $ = cheerio.load(html);
  let count = 0;
  $('table').each((_ti, tableEl) => {
    const $table = $(tableEl);
    const firstRow = $table.find('tr').first();
    const thText = firstRow.find('th').text().toLowerCase();
    if (!thText.includes('toy') || !thText.includes('col')) return;
    const rows = $table.find('tbody tr, tr');
    rows.each((ri, row) => {
      if (ri === 0 && firstRow.find('th').length > 0) return;
      const td = $(row).find('td');
      if (td.length >= 5) count++;
    });
  });
  return count;
}

async function main() {
  console.log('=== 2014 Mainline audit ===\n');

  const yearRow = await prisma.year.findFirst({ where: { year: 2014 } });
  if (!yearRow) {
    console.log('No Year row for 2014. Nothing to audit.');
    return;
  }

  const col = await prisma.collection.findFirst({
    where: { name: 'Mainline', yearId: yearRow.id },
  });
  if (!col) {
    console.log('2014 Mainline collection missing.');
    return;
  }

  let html2014: string;
  let html2015: string;
  try {
    html2014 = await fetchFandomWikiHtml(URL_2014);
  } catch (e) {
    console.error(`Wiki 2014 fetch failed: ${e}`);
    return;
  }
  try {
    html2015 = await fetchFandomWikiHtml(URL_2015);
  } catch (e) {
    console.warn(`Wiki 2015 fetch failed (2015-only sub-series check skipped): ${e}`);
    html2015 = '';
  }

  const wikiNames2014 = wikiTableSubSeriesNames(html2014);
  const wikiNorm2014 = new Set(wikiNames2014.map(normalizeSubSeriesLabel));
  const wikiRows2014 = wikiRowCountEstimate(html2014);
  console.log(`Wiki 2014: ${wikiNames2014.length} parsed tables, ~${wikiRows2014} data rows (Toy/Col heuristic)`);

  let only2015Norm = new Set<string>();
  if (html2015) {
    const wikiNames2015 = wikiTableSubSeriesNames(html2015);
    const wikiNorm2015 = new Set(wikiNames2015.map(normalizeSubSeriesLabel));
    only2015Norm = new Set(
      [...wikiNorm2015].filter(n => n.length > 0 && !wikiNorm2014.has(n)),
    );
    console.log(
      `Wiki 2015: ${wikiNames2015.length} tables; ${only2015Norm.size} normalized names not present on 2014 page (used for suspicion flags)`,
    );
  }

  const variants = await prisma.variant.findMany({
    where: { year: 2014, model: { collectionId: col.id } },
    include: {
      model: { include: { subSeries: true } },
    },
  });

  const variantCount = variants.length;
  const missingImage = variants.filter(v => v.imageId == null).length;
  const subSeriesRows = await prisma.subSeries.findMany({
    where: { collectionId: col.id },
    include: { _count: { select: { models: true } } },
  });

  console.log(
    `\nDB 2014 Mainline: variants=${variantCount}, subSeries=${subSeriesRows.length}, variants without imageId=${missingImage}`,
  );
  const delta = wikiRows2014 - variantCount;
  if (delta !== 0) {
    console.log(`  Hint: wiki row estimate − DB variants = ${delta} (heuristic; not exact)`);
  }

  const wrongYear = variants.filter(v => v.year !== 2014);
  console.log(`\n--- variant.year must be 2014 ---`);
  console.log(`Mismatches: ${wrongYear.length}`);

  const toyKey = (t: string | null | undefined) => (t ?? '').trim();
  const byToy = new Map<string, typeof variants>();
  for (const v of variants) {
    const key = toyKey(v.toyNumber);
    if (!key) continue;
    if (!byToy.has(key)) byToy.set(key, []);
    byToy.get(key)!.push(v);
  }
  const dupToy = [...byToy.entries()].filter(([, list]) => list.length > 1);
  console.log(`\n--- duplicate Toy# (non-empty, within 2014 Mainline) ---`);
  console.log(`Toy# values with >1 variant: ${dupToy.length}`);
  for (const [toy, list] of dupToy.slice(0, 15)) {
    const ids = list.map(v => v.id).join(', ');
    console.log(`  Toy# ${toy}: ${list.length} variants (ids: ${ids})`);
  }
  if (dupToy.length > 15) console.log(`  … ${dupToy.length - 15} more`);

  const notes2015 = variants.filter(
    v => v.notes && /New for 2015/i.test(v.notes),
  );
  console.log(`\n--- notes containing "New for 2015" ---`);
  console.log(`Count: ${notes2015.length}`);
  for (const v of notes2015.slice(0, 10)) {
    const name = v.model?.castingName ?? '?';
    console.log(`  id=${v.id} ${name} Toy#=${v.toyNumber} notes=${JSON.stringify(v.notes?.slice(0, 80))}`);
  }

  const dbSubNames = subSeriesRows.map(s => s.name);
  const wikiNormSetFromLabels = new Set(wikiNames2014.map(normalizeSubSeriesLabel));

  const dbNotOn2014Wiki = dbSubNames.filter(
    n => !wikiNormSetFromLabels.has(normalizeSubSeriesLabel(n)),
  );
  console.log(`\n--- DB SubSeries names with no matching 2014 wiki table label (normalized) ---`);
  console.log(`Count: ${dbNotOn2014Wiki.length}`);
  for (const n of dbNotOn2014Wiki.slice(0, 25)) {
    const row = subSeriesRows.find(s => s.name === n);
    const mc = row?._count.models ?? 0;
    console.log(`  "${n}" (models: ${mc})`);
  }
  if (dbNotOn2014Wiki.length > 25) console.log(`  … ${dbNotOn2014Wiki.length - 25} more`);

  if (only2015Norm.size > 0) {
    const suspicious = dbSubNames.filter(
      n => only2015Norm.has(normalizeSubSeriesLabel(n)),
    );
    console.log(`\n--- SubSeries on 2014 Mainline whose name matches a 2015-only wiki table (normalized) ---`);
    console.log(`Count: ${suspicious.length} (investigate if >0; may include false positives)`);
    for (const n of suspicious) {
      const row = subSeriesRows.find(s => s.name === n);
      console.log(`  "${n}" (models: ${row?._count.models ?? 0})`);
    }
  }

  const tableJunk = dbSubNames.filter(
    n => /^Table\s+\d+$/i.test(n.trim()) || /^Table\s+\d+/i.test(n.trim()),
  );
  console.log(`\n--- SubSeries names like "Table N" (often footer/junk tables) ---`);
  console.log(`Count: ${tableJunk.length}`);
  for (const n of tableJunk) {
    const row = subSeriesRows.find(s => s.name === n);
    console.log(`  "${n}" (models: ${row?._count.models ?? 0})`);
  }

  const year2015Row = await prisma.year.findFirst({ where: { year: 2015 } });
  const col2015 = year2015Row
    ? await prisma.collection.findFirst({
        where: { name: 'Mainline', yearId: year2015Row.id },
      })
    : null;
  const variants2015 = col2015
    ? await prisma.variant.findMany({
        where: { year: 2015, model: { collectionId: col2015.id } },
        select: { toyNumber: true },
      })
    : [];
  const toy2015 = new Set(
    variants2015.map(v => toyKey(v.toyNumber)).filter(Boolean),
  );
  let sharedToy = 0;
  for (const k of byToy.keys()) {
    if (toy2015.has(k)) sharedToy++;
  }
  console.log(`\n--- Toy# strings shared between 2014 and 2015 Mainline ---`);
  console.log(
    `Count: ${sharedToy} (expected: Mattel reuses codes; informational only)`,
  );

  console.log('\n=== Audit finished ===');
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
