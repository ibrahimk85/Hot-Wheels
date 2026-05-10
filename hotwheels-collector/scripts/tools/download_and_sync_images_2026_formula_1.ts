/**
 * Download & associate images for 2026 Formula 1 (Formula One Collection).
 *
 * Source: https://hotwheels.fandom.com/wiki/2026_Formula_One_Collection
 *
 * Handled table types:
 * - Singles: Photo Loose + Photo Carded
 * - 2-Packs: Photo
 * - Factory Set: Cover / Inside Cover / Display / Back
 * - Other: Box / Display
 *
 * Main image strategy:
 * - Singles: Carded -> variant.imageId
 * - 2-Packs: Photo -> variant.imageId
 * - Factory Set: Cover -> variant.imageId, others as extra images
 * - Other: Box -> variant.imageId, Display as extra image
 *
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2026_formula_1.ts
 *
 * Force refresh:
 *   set WIKI_IMAGES_FORCE=1
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import { wikiImageUrlFromCheerioImg } from '../lib/boulevard-wiki-images.ts';
import {
  isLikelyWikiPlaceholderImageFile,
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceWikiCachedFile,
} from '../lib/wiki-placeholder-image.ts';

const prisma = new PrismaClient();

const targetYear = 2026;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/2026_Formula_One_Collection';
const COLLECTION_NAME = 'Formula 1';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeWhitespace(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function downloadImage(url: string, dest: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await downloadFandomBinary(url, dest);
}

function cleanCdnUrl(raw: string): string {
  let u = raw.startsWith('//') ? `https:${raw}` : raw;
  u = u
    .replace(/\/scale-to-width-down\/\d+/g, '')
    .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
  return u;
}

function headerTextsForTable($: cheerio.CheerioAPI, table: any): string[] {
  const th = $(table).find('tr').first().find('th');
  return th
    .toArray()
    .map(el => normalizeWhitespace($(el).text()).toLowerCase())
    .filter(Boolean);
}

type TableKind = 'singles' | 'twoPacks' | 'factorySet' | 'other' | 'unknown';

function detectKind(headers: string[]): TableKind {
  const h = headers.join('|');
  if (h.includes('casting name') && h.includes('driver') && h.includes('wheel type') && h.includes('photo')) return 'singles';
  if (h === 'toy #|name|photo' || (h.includes('toy #') && h.includes('name') && h.includes('photo') && headers.length <= 3))
    return 'twoPacks';
  if (h.includes('cover') && h.includes('inside cover') && h.includes('display') && h.includes('back')) return 'factorySet';
  if (h.includes('casting(s) included') && h.includes('box') && h.includes('display')) return 'other';
  return 'unknown';
}

function extractSectionAndMix($: cheerio.CheerioAPI, table: any): { section: string; mix: string } {
  const headings = $(table).prevAll('h2, h3, h4').toArray().slice(0, 10);
  let section = '';
  let mix = '';
  for (const h of headings) {
    const t = normalizeWhitespace($(h).text().replace(/\[\]$/, ''));
    if (!t) continue;
    if (!section && /^(singles|2-packs|factory set|other)$/i.test(t)) section = t;
    if (!mix && /^(mix\s*\d+|future)$/i.test(t)) mix = t.replace(/\s+/g, ' ').replace(/^mix\s*/i, 'Mix ');
    if (section && mix) break;
  }
  return { section: section || 'Unknown', mix: mix || '' };
}

async function ensureVariantByToyNumber(toyNumber: string) {
  return prisma.variant.findFirst({
    where: {
      year: targetYear,
      toyNumber,
      model: { collection: { name: COLLECTION_NAME, year: { year: targetYear } } },
    },
    include: { model: true },
  });
}

async function ensureImageRecord(variantId: number, relPath: string, alt: string) {
  const existing = await prisma.image.findFirst({ where: { variantId, path: relPath } });
  if (existing) return existing;
  return prisma.image.create({
    data: { path: relPath, alt, variant: { connect: { id: variantId } } },
  });
}

async function maybeDownloadAndAttach(params: {
  variantId: number;
  castingName: string;
  castingSlug: string;
  toyNumber: string;
  baseSubdir: string;
  kind: string;
  urlRaw: string;
  isMain: boolean;
}) {
  const { variantId, castingName, castingSlug, toyNumber, baseSubdir, kind, urlRaw, isMain } = params;
  const cleaned = cleanCdnUrl(urlRaw);
  if (!cleaned || isWikiPlaceholderOrMissingImageUrl(cleaned)) return { downloaded: 0, associated: 0 };

  const extMatch = new URL(cleaned).pathname.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'jpg';

  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    targetYear.toString(),
    ...baseSubdir.split('/'),
    castingSlug,
  );
  await fs.promises.mkdir(baseDir, { recursive: true });

  const safeToy = sanitizeFileName(toyNumber);
  const fileName = `${safeToy}_${kind}.${ext}`;
  const destPath = path.join(baseDir, fileName);
  const relPath = `/images/hotwheels/${targetYear}/${baseSubdir}/${castingSlug}/${fileName}`;

  let downloaded = 0;
  if (await shouldDownloadOrReplaceWikiCachedFile(destPath)) {
    if (fs.existsSync(destPath)) await fs.promises.unlink(destPath).catch(() => {});
    try {
      await downloadImage(cleaned, destPath);
      if (await isLikelyWikiPlaceholderImageFile(destPath)) {
        await fs.promises.unlink(destPath).catch(() => {});
      } else {
        downloaded++;
        console.log(`Downloaded ${kind}: ${castingName} → ${fileName}`);
      }
    } catch (e) {
      console.error(`Download failed (${kind}) for ${castingName}:`, e);
    }
  }

  if (!fs.existsSync(destPath)) return { downloaded, associated: 0 };

  let associated = 0;
  try {
    const img = await ensureImageRecord(variantId, relPath, `${castingName} (${kind})`);
    associated++;
    if (isMain) {
      const v = await prisma.variant.findUnique({ where: { id: variantId } });
      if (v && !v.imageId) {
        await prisma.variant.update({ where: { id: variantId }, data: { imageId: img.id } });
      }
    }
  } catch (e) {
    console.error(`Associate failed (${kind}) for ${castingName}:`, e);
  }

  return { downloaded, associated };
}

async function main() {
  console.log('=== FORMULA 1 (2026) IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);

  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const headers = headerTextsForTable($, table);
    const kind = detectKind(headers);
    if (kind === 'unknown') continue;

    const { mix } = extractSectionAndMix($, table);
    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 1);
    if (rows.length === 0) continue;

    console.log(`Processing ${rows.length} row(s) from table #${tableIdx + 1} (${kind}${mix ? ` / ${mix}` : ''})…`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (!cells.length) continue;

      if (kind === 'singles') {
        const toyNumber = sanitizeFileName($(cells[0]).text().trim());
        const castingLink = $(cells[1]).find('a').first();
        const castingName = castingLink.length ? castingLink.text().trim() : $(cells[1]).text().trim();
        if (!toyNumber || !castingName) continue;

        const variant = await ensureVariantByToyNumber(toyNumber);
        if (!variant) {
          console.warn(`Variant not found for Toy# ${toyNumber} (${castingName}); skipping.`);
          continue;
        }

        const castingSlug = slugify(castingName);
        const cardedColIdx = cells.length - 1;
        const looseColIdx = cells.length - 2;
        const cardedRaw = wikiImageUrlFromCheerioImg($(cells[cardedColIdx]).find('img').first());
        const looseRaw = looseColIdx >= 0 ? wikiImageUrlFromCheerioImg($(cells[looseColIdx]).find('img').first()) : '';

        if (cardedRaw) {
          const r = await maybeDownloadAndAttach({
            variantId: variant.id,
            castingName,
            castingSlug,
            toyNumber,
            baseSubdir: 'formula-1/singles',
            kind: 'carded',
            urlRaw: cardedRaw,
            isMain: true,
          });
          downloadCount += r.downloaded;
          associatedCount += r.associated;
        }
        if (looseRaw) {
          const r = await maybeDownloadAndAttach({
            variantId: variant.id,
            castingName,
            castingSlug,
            toyNumber,
            baseSubdir: 'formula-1/singles',
            kind: 'loose',
            urlRaw: looseRaw,
            isMain: false,
          });
          downloadCount += r.downloaded;
          associatedCount += r.associated;
        }
        continue;
      }

      if (kind === 'twoPacks') {
        const toyNumber = sanitizeFileName($(cells[0]).text().trim());
        const nameLink = $(cells[1]).find('a').first();
        const name = nameLink.length ? nameLink.text().trim() : $(cells[1]).text().trim();
        const photoRaw = cells.length > 2 ? wikiImageUrlFromCheerioImg($(cells[2]).find('img').first()) : '';
        if (!toyNumber || !name || !photoRaw) continue;

        const variant = await ensureVariantByToyNumber(toyNumber);
        if (!variant) {
          console.warn(`Variant not found for 2-Pack Toy# ${toyNumber} (${name}); skipping.`);
          continue;
        }

        const slug = slugify(name);
        const r = await maybeDownloadAndAttach({
          variantId: variant.id,
          castingName: name,
          castingSlug: slug,
          toyNumber,
          baseSubdir: 'formula-1/2-packs',
          kind: 'main',
          urlRaw: photoRaw,
          isMain: true,
        });
        downloadCount += r.downloaded;
        associatedCount += r.associated;
        continue;
      }

      if (kind === 'factorySet') {
        const toyNumber = sanitizeFileName($(cells[0]).text().trim());
        const notes = cells.length > 1 ? normalizeWhitespace($(cells[1]).text()) : '';
        if (!toyNumber) continue;

        const variant = await ensureVariantByToyNumber(toyNumber);
        if (!variant) {
          console.warn(`Variant not found for Factory Set Toy# ${toyNumber}; skipping.`);
          continue;
        }

        const castingName = 'Formula One Factory Set';
        const castingSlug = slugify(castingName);
        const coverRaw = cells.length > 2 ? wikiImageUrlFromCheerioImg($(cells[2]).find('img').first()) : '';
        const insideRaw = cells.length > 3 ? wikiImageUrlFromCheerioImg($(cells[3]).find('img').first()) : '';
        const displayRaw = cells.length > 4 ? wikiImageUrlFromCheerioImg($(cells[4]).find('img').first()) : '';
        const backRaw = cells.length > 5 ? wikiImageUrlFromCheerioImg($(cells[5]).find('img').first()) : '';

        for (const [raw, kindName, isMain] of [
          [coverRaw, 'cover', true],
          [insideRaw, 'inside-cover', false],
          [displayRaw, 'display', false],
          [backRaw, 'back', false],
        ] as const) {
          if (!raw) continue;
          const r = await maybeDownloadAndAttach({
            variantId: variant.id,
            castingName: notes ? `${castingName} (${notes})` : castingName,
            castingSlug,
            toyNumber,
            baseSubdir: 'formula-1/factory-set',
            kind: kindName,
            urlRaw: raw,
            isMain,
          });
          downloadCount += r.downloaded;
          associatedCount += r.associated;
        }
        continue;
      }

      if (kind === 'other') {
        const toyNumber = sanitizeFileName($(cells[0]).text().trim());
        const notes = cells.length > 1 ? normalizeWhitespace($(cells[1]).text()) : '';
        const boxRaw = cells.length > 3 ? wikiImageUrlFromCheerioImg($(cells[3]).find('img').first()) : '';
        const displayRaw = cells.length > 4 ? wikiImageUrlFromCheerioImg($(cells[4]).find('img').first()) : '';
        if (!toyNumber) continue;

        const variant = await ensureVariantByToyNumber(toyNumber);
        if (!variant) {
          console.warn(`Variant not found for Other Toy# ${toyNumber}; skipping.`);
          continue;
        }

        const castingName = notes || 'Formula One Other Set';
        const castingSlug = slugify(castingName);

        if (boxRaw) {
          const r = await maybeDownloadAndAttach({
            variantId: variant.id,
            castingName,
            castingSlug,
            toyNumber,
            baseSubdir: 'formula-1/other',
            kind: 'box',
            urlRaw: boxRaw,
            isMain: true,
          });
          downloadCount += r.downloaded;
          associatedCount += r.associated;
        }
        if (displayRaw) {
          const r = await maybeDownloadAndAttach({
            variantId: variant.id,
            castingName,
            castingSlug,
            toyNumber,
            baseSubdir: 'formula-1/other',
            kind: 'display',
            urlRaw: displayRaw,
            isMain: false,
          });
          downloadCount += r.downloaded;
          associatedCount += r.associated;
        }
        continue;
      }
    }
  }

  console.log(`\nDone. ${downloadCount} downloaded, ${associatedCount} associated.`);
}

main()
  .catch((e) => {
    console.error('Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

