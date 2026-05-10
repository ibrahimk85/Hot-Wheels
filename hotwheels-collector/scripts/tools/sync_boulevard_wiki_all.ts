/**
 * Full Boulevard sync from Fandom wiki for years 2012, 2013, 2020–2026.
 * - Upserts variant fields from wiki (color, notes, wheelType, releaseName, cardNumber).
 * - Updates model.castingId (Toy#) and optional metadata from model pages.
 * - Merges duplicate variants (same stable key): OR-combines packedOwned, looseOwned, wishlisted, owned; max quantity.
 * - Deletes wiki orphans only when safe (no packed/loose/wish/owned/quantity, no price alerts).
 * - Removes empty models (and empty sub-series) in the Boulevard collection.
 *
 * Does NOT clear packedOwned, looseOwned, wishlisted, owned, quantity on update.
 *
 *   npx ts-node scripts/tools/sync_boulevard_wiki_all.ts --all
 *   npx ts-node scripts/tools/sync_boulevard_wiki_all.ts --year 2024
 *   npx ts-node scripts/tools/sync_boulevard_wiki_all.ts --all --dry-run
 *   npx ts-node scripts/tools/sync_boulevard_wiki_all.ts --all --with-images
 *   npx ts-node scripts/tools/sync_boulevard_wiki_all.ts --all --refresh-metadata   # slower: refetch all model pages
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { stableBoulevardKey } from '../lib/boulevard-wiki-key.ts';

const prisma = new PrismaClient();

const BOULEVARD_YEARS = [2012, 2013, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

function boulevardWikiUrl(year: number): string {
  return `https://hotwheels.fandom.com/wiki/${year}_Hot_Wheels_Boulevard`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface ParsedWikiRow {
  mix: string;
  toyNumber: string;
  seriesNumber: string | null;
  castingName: string;
  color: string;
  wheelType: string;
  notes: string;
  modelHref: string | null;
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

function parseWikiRows(year: number, html: string): ParsedWikiRow[] {
  const $ = cheerio.load(html);
  const tables = $('table.wikitable');
  const rows: ParsedWikiRow[] = [];
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

    const bodyRows = $(table).find('tbody tr').filter((_j, row) => $(row).find('td').length >= 3);

    bodyRows.each((_j, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      if (isEarly) {
        const toyNumber = $(cells[0]).text().trim();
        const castingLink = $(cells[1]).find('a').first();
        const castingNameRaw =
          castingLink.length > 0 ? castingLink.text().trim() : $(cells[1]).text().trim();
        const bodyColor = cells.length > 2 ? $(cells[2]).text().trim() : '';
        const notes = cells.length > 3 ? $(cells[3]).text().trim() : '';
        const href = castingLink.attr('href') ?? null;
        if (!toyNumber || !castingNameRaw) return;
        rows.push({
          mix: mixName,
          toyNumber,
          seriesNumber: null,
          castingName: castingNameRaw,
          color: bodyColor,
          wheelType: '',
          notes,
          modelHref: href,
        });
      } else {
        const toyNumber = $(cells[0]).text().trim();
        const seriesNumber = $(cells[1]).text().trim();
        const castingLink = $(cells[2]).find('a').first();
        const castingNameRaw =
          castingLink.length > 0 ? castingLink.text().trim() : $(cells[2]).text().trim();
        const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
        const wheelType = cells.length > 4 ? $(cells[4]).text().trim() : '';
        const notes = cells.length > 5 ? $(cells[5]).text().trim() : '';
        const href = castingLink.attr('href') ?? null;
        if (!toyNumber || !seriesNumber || !castingNameRaw) return;
        rows.push({
          mix: mixName,
          toyNumber,
          seriesNumber,
          castingName: castingNameRaw,
          color: bodyColor,
          wheelType,
          notes,
          modelHref: href,
        });
      }
    });
  });

  return rows;
}

function wikiRowKey(year: number, row: ParsedWikiRow): string {
  return stableBoulevardKey(year, row.mix, row.seriesNumber ?? row.toyNumber, row.toyNumber);
}

async function fetchModelMetadata(modelUrl: string): Promise<{
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
  description: string | null;
}> {
  const empty = {
    debutSeries: null,
    produced: null,
    designer: null,
    castingNumber: null,
    description: null,
  };
  try {
    const html = await fetchFandomWikiHtml(modelUrl);
    const $ = cheerio.load(html);
    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    let description: string | null = null;
    const infobox = $('.infobox, .wikitable').first();
    if (infobox.length > 0) {
      infobox.find('tr').each((_, r) => {
        const cells = $(r).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();
          if (/debut|first.*appear/i.test(label)) debutSeries = value || null;
          if (/produced|years/i.test(label)) produced = value || null;
          if (/designer/i.test(label)) designer = value || null;
          if (/number|casting.*number/i.test(label)) castingNumber = value || null;
        }
      });
    }
    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) description = descriptionPara;
    return { debutSeries, produced, designer, castingNumber, description };
  } catch {
    return empty;
  }
}

function modelPageUrl(href: string | null): string | null {
  if (!href) return null;
  return href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
}

async function canAutoDeleteVariant(variantId: number): Promise<boolean> {
  const v = await prisma.variant.findUnique({
    where: { id: variantId },
    include: { _count: { select: { priceAlerts: true } } },
  });
  if (!v) return false;
  if (v.packedOwned || v.looseOwned || v.wishlisted || v.owned || v.quantity > 0) return false;
  if (v._count.priceAlerts > 0) return false;
  return true;
}

async function mergeUserFieldsOnto(keepId: number, fromId: number, dryRun: boolean): Promise<void> {
  const [a, b] = await Promise.all([
    prisma.variant.findUnique({ where: { id: keepId } }),
    prisma.variant.findUnique({ where: { id: fromId } }),
  ]);
  if (!a || !b) return;
  const data = {
    packedOwned: a.packedOwned || b.packedOwned,
    looseOwned: a.looseOwned || b.looseOwned,
    wishlisted: a.wishlisted || b.wishlisted,
    owned: a.owned || b.owned,
    quantity: Math.max(a.quantity, b.quantity),
  };
  if (dryRun) return;
  await prisma.variant.update({ where: { id: keepId }, data });
}

function cardNumberForDb(year: number, row: ParsedWikiRow): string {
  if (year === 2012 || year === 2013) return row.toyNumber;
  return row.seriesNumber ?? '';
}

async function syncYear(
  year: number,
  options: { dryRun: boolean; refreshMetadata: boolean },
): Promise<{ updated: number; created: number; deleted: number; merged: number }> {
  let updated = 0;
  let created = 0;
  let deleted = 0;
  let merged = 0;

  const url = boulevardWikiUrl(year);
  console.log(`\n=== Sync Boulevard ${year} ===\n${url}`);

  const html = await fetchFandomWikiHtml(url);
  const parsed = parseWikiRows(year, html);
  const wikiByKey = new Map<string, ParsedWikiRow>();
  for (const row of parsed) {
    const k = wikiRowKey(year, row);
    if (wikiByKey.has(k)) {
      console.warn(`Wiki duplicate key (last wins): ${k}`);
    }
    wikiByKey.set(k, row);
  }

  let yearRecord = await prisma.year.findFirst({ where: { year } });
  if (!yearRecord) {
    if (options.dryRun) {
      console.log(`[dry-run] No Year ${year} in DB — skipping (create year first for a real run).`);
      return { updated, created, deleted, merged };
    }
    yearRecord = await prisma.year.create({ data: { year } });
  }

  let collectionRecord = await prisma.collection.findFirst({
    where: { name: 'Boulevard', yearId: yearRecord.id },
  });
  if (!collectionRecord) {
    if (options.dryRun) {
      console.log(`[dry-run] No Boulevard collection for ${year} — skipping.`);
      return { updated, created, deleted, merged };
    }
    collectionRecord = await prisma.collection.create({
      data: {
        name: 'Boulevard',
        code: 'Boulevard',
        year: { connect: { id: yearRecord.id } },
      },
    });
  }

  const variants = await prisma.variant.findMany({
    where: { year, model: { collectionId: collectionRecord.id } },
    include: {
      model: { include: { subSeries: true } },
      _count: { select: { priceAlerts: true } },
    },
  });

  const byKey = new Map<string, typeof variants>();
  for (const v of variants) {
    const mix = v.model.subSeries?.name ?? '';
    const k = stableBoulevardKey(year, mix, v.cardNumber, v.model.castingId ?? v.cardNumber ?? '');
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(v);
  }

  for (const [key, list] of byKey) {
    if (list.length <= 1) continue;
    list.sort((a, b) => a.id - b.id);
    const keep = list[0]!;
    for (const dup of list.slice(1)) {
      console.log(`Merge duplicate key ${key}: keep variant ${keep.id}, fold ${dup.id}`);
      await mergeUserFieldsOnto(keep.id, dup.id, options.dryRun);
      merged++;
      if (!options.dryRun && (await canAutoDeleteVariant(dup.id))) {
        try {
          await prisma.variant.delete({ where: { id: dup.id } });
          deleted++;
        } catch (e) {
          console.warn(`Could not delete merged variant ${dup.id}: ${e}`);
        }
      }
    }
  }

  const refreshedVariants = await prisma.variant.findMany({
    where: { year, model: { collectionId: collectionRecord.id } },
    include: { model: { include: { subSeries: true } } },
  });

  const byKey2 = new Map<string, (typeof refreshedVariants)[0]>();
  for (const v of refreshedVariants) {
    const mix = v.model.subSeries?.name ?? '';
    const k = stableBoulevardKey(year, mix, v.cardNumber, v.model.castingId ?? v.cardNumber ?? '');
    if (!byKey2.has(k)) byKey2.set(k, v);
  }

  const metadataCache = new Map<string, Awaited<ReturnType<typeof fetchModelMetadata>>>();
  const subSeriesCache = new Map<string, number>();
  const modelCache = new Map<string, number>();

  async function getSubSeriesId(mixName: string): Promise<number> {
    if (subSeriesCache.has(mixName)) return subSeriesCache.get(mixName)!;
    let sub = await prisma.subSeries.findFirst({
      where: { name: mixName, collectionId: collectionRecord!.id },
    });
    if (!sub) {
      sub = await prisma.subSeries.create({
        data: { name: mixName, collection: { connect: { id: collectionRecord!.id } } },
      });
    }
    subSeriesCache.set(mixName, sub.id);
    return sub.id;
  }

  for (const [key, row] of wikiByKey) {
    let variant = byKey2.get(key);
    const cardStr = cardNumberForDb(year, row);

    if (!variant) {
      if (options.dryRun) {
        created++;
        continue;
      }

      const subSeriesId = await getSubSeriesId(row.mix);
      const modelKey = `${row.castingName}\0${row.mix}`;
      let modelId = modelCache.get(modelKey);
      if (modelId === undefined) {
        let model = await prisma.model.findFirst({
          where: { castingName: row.castingName, subSeriesId },
        });
        if (!model) {
          let meta = metadataCache.get(row.castingName);
          if (meta === undefined) {
            const murl = modelPageUrl(row.modelHref);
            if (murl) {
              meta = await fetchModelMetadata(murl);
              await sleep(350);
            } else {
              meta = {
                debutSeries: null,
                produced: null,
                designer: null,
                castingNumber: null,
                description: null,
              };
            }
            metadataCache.set(row.castingName, meta);
          }
          model = await prisma.model.create({
            data: {
              castingName: row.castingName,
              castingId: row.toyNumber,
              description: meta!.description,
              debutSeries: meta!.debutSeries,
              produced: meta!.produced,
              designer: meta!.designer,
              castingNumber: meta!.castingNumber,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: subSeriesId } },
            },
          });
          console.log(`Created model ${row.castingName} (${row.mix})`);
        }
        modelId = model!.id;
        modelCache.set(modelKey, modelId);
      }

      await prisma.variant.create({
        data: {
          modelId,
          year,
          releaseName: row.mix,
          color: row.color || undefined,
          cardNumber: cardStr,
          wheelType: row.wheelType || undefined,
          notes: row.notes || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
        },
      });
      created++;
      console.log(`Created variant key=${key} ${row.castingName}`);
      continue;
    }

    if (options.dryRun) {
      updated++;
      continue;
    }

    let metaPatch: Record<string, unknown> = {};
    if (options.refreshMetadata) {
      const murl = modelPageUrl(row.modelHref);
      if (murl) {
        let meta = metadataCache.get(row.castingName);
        if (meta === undefined) {
          meta = await fetchModelMetadata(murl);
          metadataCache.set(row.castingName, meta);
          await sleep(350);
        }
        metaPatch = {
          description: meta.description,
          debutSeries: meta.debutSeries,
          produced: meta.produced,
          designer: meta.designer,
          castingNumber: meta.castingNumber,
        };
      }
    }

    await prisma.model.update({
      where: { id: variant.modelId },
      data: {
        castingId: row.toyNumber,
        castingName: row.castingName,
        ...metaPatch,
      },
    });

    await prisma.variant.update({
      where: { id: variant.id },
      data: {
        releaseName: row.mix,
        color: row.color || undefined,
        cardNumber: cardStr,
        wheelType: row.wheelType || undefined,
        notes: row.notes || undefined,
      },
    });
    updated++;
  }

  const finalVariants = await prisma.variant.findMany({
    where: { year, model: { collectionId: collectionRecord.id } },
    include: { model: { include: { subSeries: true } } },
  });

  for (const v of finalVariants) {
    const mix = v.model.subSeries?.name ?? '';
    const k = stableBoulevardKey(year, mix, v.cardNumber, v.model.castingId ?? v.cardNumber ?? '');
    if (!wikiByKey.has(k)) {
      if (await canAutoDeleteVariant(v.id)) {
        if (options.dryRun) {
          console.log(`Would delete orphan variant ${v.id} ${v.model.castingName}`);
          deleted++;
        } else {
          try {
            await prisma.variant.delete({ where: { id: v.id } });
            deleted++;
            console.log(`Deleted orphan variant ${v.id} ${v.model.castingName}`);
          } catch (e) {
            console.warn(`Could not delete orphan ${v.id}: ${e}`);
          }
        }
      } else {
        console.warn(
          `Orphan (not on wiki) kept — user data or alerts: variant ${v.id} ${v.model.castingName}`,
        );
      }
    }
  }

  if (!options.dryRun) {
    await prisma.model.deleteMany({
      where: {
        collectionId: collectionRecord.id,
        variants: { none: {} },
      },
    });
    await prisma.subSeries.deleteMany({
      where: {
        collectionId: collectionRecord.id,
        models: { none: {} },
      },
    });
  }

  return { updated, created, deleted, merged };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const withImages = process.argv.includes('--with-images');
  const refreshMetadata = process.argv.includes('--refresh-metadata');
  const all = process.argv.includes('--all');
  const yIdx = process.argv.indexOf('--year');
  const years: number[] = [];
  if (all) years.push(...BOULEVARD_YEARS);
  else if (yIdx >= 0 && process.argv[yIdx + 1]) years.push(parseInt(process.argv[yIdx + 1]!, 10));
  else {
    console.error(
      'Usage: sync_boulevard_wiki_all.ts --all | --year YYYY [--dry-run] [--with-images] [--refresh-metadata]',
    );
    process.exit(1);
  }

  let totals = { updated: 0, created: 0, deleted: 0, merged: 0 };
  for (const year of years) {
    if (!BOULEVARD_YEARS.includes(year as (typeof BOULEVARD_YEARS)[number])) {
      console.warn(`Skip unsupported year: ${year}`);
      continue;
    }
    const r = await syncYear(year, { dryRun, refreshMetadata });
    totals.updated += r.updated;
    totals.created += r.created;
    totals.deleted += r.deleted;
    totals.merged += r.merged;
  }

  console.log(`\n=== Boulevard sync totals ===`);
  console.log(JSON.stringify(totals, null, 2));
  console.log(`dryRun=${dryRun}`);

  if (withImages && !dryRun) {
    console.log('\nRunning image download scripts…');
    for (const y of years.filter(y => BOULEVARD_YEARS.includes(y as (typeof BOULEVARD_YEARS)[number]))) {
      const script = `scripts/tools/download_and_sync_images_${y}_boulevard.ts`;
      console.log(`\n>> npx ts-node ${script}`);
      execSync(`npx ts-node ${script}`, { stdio: 'inherit', cwd: process.cwd() });
    }
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
