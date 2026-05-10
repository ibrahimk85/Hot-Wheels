/**
 * Compare Fandom mainline list page(s) with the local DB for one year or all years (2026→2000).
 * Uses mainline_urls.json / hub defaults, fetchFandomWikiHtml, MediaWiki sections API, Prisma.
 *
 *   npx ts-node scripts/tools/audit_mainline_year.ts --year 2025
 *   npx ts-node scripts/tools/audit_mainline_year.ts --all
 *   npx ts-node scripts/tools/audit_mainline_year.ts --all --sync-urls   # refresh JSON from hub first
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import {
  FANDOM_DOC_HEADERS,
  fetchFandomWikiHtml,
  wikiPageTitleFromArticleUrl,
} from '../lib/fandom-fetch.ts';
import { getMainlineWikiUrlForYear } from '../lib/mainline-urls.ts';

const prisma = new PrismaClient();

interface WikiTableStats {
  toyColTables: number;
  dataRowsGte5Cols: number;
}

function wikiTableStats(html: string): WikiTableStats {
  const $ = cheerio.load(html);
  let toyColTables = 0;
  let dataRowsGte5Cols = 0;

  $('table').each((_ti, tableEl) => {
    const $table = $(tableEl);
    const firstRow = $table.find('tr').first();
    const thText = firstRow.find('th').text().toLowerCase();
    if (!thText.includes('toy') || !thText.includes('col')) return;
    toyColTables++;

    const rows = $table.find('tbody tr, tr');
    rows.each((ri, row) => {
      if (ri === 0 && firstRow.find('th').length > 0) return;
      const td = $(row).find('td');
      if (td.length >= 5) dataRowsGte5Cols++;
    });
  });

  return { toyColTables, dataRowsGte5Cols };
}

interface MwSection {
  line?: string;
  level?: string;
}

async function mediaWikiSections(pageTitle: string): Promise<MwSection[]> {
  const api = new URL('https://hotwheels.fandom.com/api.php');
  api.searchParams.set('action', 'parse');
  api.searchParams.set('page', pageTitle);
  api.searchParams.set('prop', 'sections');
  api.searchParams.set('format', 'json');
  api.searchParams.set('formatversion', '2');

  const res = await fetch(api.toString(), { headers: FANDOM_DOC_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    console.warn(`sections API ${res.status} for ${pageTitle}`);
    return [];
  }
  const data = (await res.json()) as { parse?: { sections?: MwSection[] }; error?: { info?: string } };
  if (data.error?.info) {
    console.warn(`sections API: ${data.error.info}`);
    return [];
  }
  return data.parse?.sections ?? [];
}

async function auditOneYear(year: number): Promise<void> {
  const url = getMainlineWikiUrlForYear(year);
  const title = wikiPageTitleFromArticleUrl(url);
  console.log(`\n=== ${year} ===`);
  console.log(`URL: ${url}`);

  let html: string;
  try {
    html = await fetchFandomWikiHtml(url);
  } catch (e) {
    console.error(`  Wiki fetch failed: ${e}`);
    return;
  }

  const wt = wikiTableStats(html);
  console.log(
    `Wiki: Toy/Col tables=${wt.toyColTables}, data rows (≥5 td)=${wt.dataRowsGte5Cols}`,
  );

  const sections = await mediaWikiSections(title);
  const h2h3 = sections.filter(s => s.level === '2' || s.level === '3').map(s => s.line?.trim() ?? '');
  console.log(`Wiki sections (h2/h3): ${h2h3.length} — ${h2h3.slice(0, 12).join(' | ')}${h2h3.length > 12 ? ' …' : ''}`);

  const yearRow = await prisma.year.findFirst({ where: { year } });
  if (!yearRow) {
    console.log('DB: Year record missing; variants=0, missing images=n/a');
    return;
  }

  const col = await prisma.collection.findFirst({
    where: { name: 'Mainline', yearId: yearRow.id },
  });
  if (!col) {
    console.log('DB: Mainline collection missing');
    return;
  }

  const variantCount = await prisma.variant.count({
    where: { year, model: { collectionId: col.id } },
  });
  const missingImage = await prisma.variant.count({
    where: { year, model: { collectionId: col.id }, imageId: null },
  });
  const subCount = await prisma.subSeries.count({ where: { collectionId: col.id } });

  console.log(
    `DB: variants=${variantCount}, subSeries=${subCount}, variants without imageId=${missingImage}`,
  );
  const delta = wt.dataRowsGte5Cols - variantCount;
  if (delta !== 0) {
    console.log(`  Hint: wiki row estimate − DB variants = ${delta} (tables/rows are heuristic).`);
  }
}

async function main() {
  const syncUrls = process.argv.includes('--sync-urls');
  if (syncUrls) {
    console.log('Running sync_mainline_urls_from_hub…');
    execSync('npx ts-node scripts/tools/sync_mainline_urls_from_hub.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }

  const all = process.argv.includes('--all');
  const yIdx = process.argv.indexOf('--year');
  const years: number[] = [];
  if (all) {
    for (let y = 2026; y >= 2000; y--) years.push(y);
  } else if (yIdx >= 0 && process.argv[yIdx + 1]) {
    years.push(parseInt(process.argv[yIdx + 1]!, 10));
  } else {
    console.error(
      'Usage: audit_mainline_year.ts --year YYYY | --all [--sync-urls]',
    );
    process.exit(1);
  }

  for (const y of years) {
    if (isNaN(y) || y < 2000 || y > 2026) continue;
    await auditOneYear(y);
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
