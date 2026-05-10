/**
 * Download Fast & Furious (2026) wiki images: Tokyo Drift + Dream Lineup.
 * Uses fetchFandomWikiHtml (browser-like headers + action=render + MediaWiki parse API on 403).
 *
 * Wiki tables may be 10 columns (no Film) or 11+; column indices come from the header row.
 *
 *   npx ts-node scripts/tools/download_and_sync_images_2026_fast_and_furious.ts
 *
 * Force re-download: WIKI_IMAGES_FORCE=1
 * Optional: FF_2026_SUBSERIES=Dream Lineup → only that sub-series
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { downloadFandomBinary, fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { wikiImageUrlFromCheerioImg } from '../lib/boulevard-wiki-images.ts';
import {
  isLikelyWikiPlaceholderImageFile,
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceWikiCachedFile,
} from '../lib/wiki-placeholder-image.ts';
import {
  fastAndFuriousSeriesColumnMapFromTable,
  parseFfSeriesTableRowForImport,
} from '../lib/fast-and-furious-series-wiki-table.ts';

const prisma = new PrismaClient();

const targetYear = 2026;

const URLS = [
  {
    url: 'https://hotwheels.fandom.com/wiki/The_Fast_and_the_Furious:_Tokyo_Drift_Series_(2026)',
    subSeriesName: 'Tokyo Drift',
  },
  {
    url: 'https://hotwheels.fandom.com/wiki/Fast_%26_Furious:_Dream_Lineup_Series_(2026)',
    subSeriesName: 'Dream Lineup',
  },
];

const ffSubFilter = process.env.FF_2026_SUBSERIES?.trim();
const URLS_TO_PROCESS = ffSubFilter
  ? URLS.filter((u) => u.subSeriesName === ffSubFilter)
  : URLS;
if (ffSubFilter && URLS_TO_PROCESS.length === 0) {
  throw new Error(`FF_2026_SUBSERIES="${ffSubFilter}" does not match Tokyo Drift or Dream Lineup`);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findFfVariantWithColorFallback(
  db: PrismaClient,
  w: {
    modelId: number;
    year: number;
    releaseName: string;
    cardNumber: string | null;
    color: string | null;
  },
) {
  let v = await db.variant.findFirst({
    where: {
      modelId: w.modelId,
      year: w.year,
      releaseName: w.releaseName,
      cardNumber: w.cardNumber,
      color: w.color,
    },
    include: { images: true },
  });
  if (!v && w.color !== null) {
    v = await db.variant.findFirst({
      where: {
        modelId: w.modelId,
        year: w.year,
        releaseName: w.releaseName,
        cardNumber: w.cardNumber,
      },
      orderBy: { id: 'asc' },
      include: { images: true },
    });
  }
  return v;
}

async function main() {
  console.log('=== FAST & FURIOUS 2026 — IMAGE DOWNLOAD ===');
  console.log(`Uses wiki fetch with MediaWiki API fallback on 403.`);

  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    String(targetYear),
    'fast-and-furious',
  );
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  if (ffSubFilter) {
    console.log(`FF_2026_SUBSERIES=${ffSubFilter} — ${URLS_TO_PROCESS.length} URL(s).`);
  }

  for (const { url, subSeriesName } of URLS_TO_PROCESS) {
    console.log(`\n=== ${subSeriesName} ===`);
    let html: string;
    try {
      html = await fetchFandomWikiHtml(url);
    } catch (e) {
      console.error(`Fetch failed ${url}:`, e);
      continue;
    }

    const $ = cheerio.load(html);
    const table = $('table.wikitable').first();
    if (table.length === 0) {
      console.error(`No wikitable on ${url}`);
      continue;
    }

    const colMap = fastAndFuriousSeriesColumnMapFromTable($, table);
    if (!colMap) {
      console.error(`Could not read table headers on ${url}`);
      continue;
    }
    console.log(
      `Columns: loose=${colMap.loose} carded=${colMap.carded} (film=${colMap.film ?? '—'})`,
    );

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      return $(row).find('td').length >= 3;
    });

    console.log(`Rows: ${rows.length}`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length === 0) continue;

      const parsed = parseFfSeriesTableRowForImport($, cells, colMap);
      if (!parsed) {
        console.warn(`Row ${i + 1}: missing casting name`);
        continue;
      }

      const { collectorNumber, toyNumber, castingName, color } = parsed;

      const model = await prisma.model.findFirst({
        where: {
          castingName,
          subSeries: {
            name: subSeriesName,
            collection: {
              name: 'Fast & Furious',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${subSeriesName})`);
        continue;
      }

      const variant = await findFfVariantWithColorFallback(prisma, {
        modelId: model.id,
        year: targetYear,
        releaseName: subSeriesName,
        cardNumber: collectorNumber ?? null,
        color: color && color.trim() !== '' ? color.trim() : null,
      });

      if (!variant) {
        console.warn(
          `Variant not found: ${castingName} #${collectorNumber ?? 'N/A'} color=${color || 'N/A'}`,
        );
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const sanitizedToyNumber =
        toyNumber && toyNumber.trim() !== ''
          ? toyNumber.replace(/[/\\<>:"|?*]/g, '_')
          : undefined;

      const cardedIdx = colMap.carded;
      const looseIdx = colMap.loose;

      if (cardedIdx >= 0 && cardedIdx < cells.length) {
        const imgEl = $(cells[cardedIdx]).find('img').first();
        const raw = wikiImageUrlFromCheerioImg(imgEl);
        if (raw) {
          let imgUrl = raw.startsWith('//') ? `https:${raw}` : raw;
          const fullUrl = imgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          try {
            const urlObj = new URL(fullUrl);
            const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const fileName = sanitizedToyNumber
              ? `${sanitizedToyNumber}_carded.${ext}`
              : `${castingSlug}_carded.${ext}`;
            const destPath = path.join(targetFolder, fileName);

            if (isWikiPlaceholderOrMissingImageUrl(fullUrl)) {
              console.warn(`Carded URL is wiki placeholder, skip: ${castingName}`);
              if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
                await fs.promises.unlink(destPath).catch(() => {});
              }
            } else if (await shouldDownloadOrReplaceWikiCachedFile(destPath)) {
              if (fs.existsSync(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
              }
              try {
                await downloadFandomBinary(fullUrl, destPath);
                if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                  await fs.promises.unlink(destPath).catch(() => {});
                  console.warn(`Carded download still placeholder, removed: ${castingName}`);
                } else {
                  downloadCount++;
                  console.log(`Downloaded carded: ${castingName} → ${fileName}`);
                }
              } catch (err) {
                console.error(`Carded download error ${castingName}:`, err);
              }
            }

            const relativePath = `/images/hotwheels/${targetYear}/fast-and-furious/${castingSlug}/${fileName}`;
            if (fs.existsSync(destPath) && !(await isLikelyWikiPlaceholderImageFile(destPath))) {
              try {
                let imageRecord = await prisma.image.findFirst({
                  where: { variantId: variant.id, path: relativePath },
                });
                if (!imageRecord) {
                  imageRecord = await prisma.image.create({
                    data: {
                      path: relativePath,
                      alt: `${castingName} (Carded)`,
                      variant: { connect: { id: variant.id } },
                    },
                  });
                  associatedCount++;
                }
                if (variant.imageId !== imageRecord.id) {
                  await prisma.variant.update({
                    where: { id: variant.id },
                    data: { imageId: imageRecord.id },
                  });
                  associatedCount++;
                  console.log(`Set imageId → carded: ${castingName}`);
                }
              } catch (err) {
                console.error(`Carded DB error ${castingName}:`, err);
              }
            }
          } catch {
            /* bad URL */
          }
        }
      }

      if (looseIdx >= 0 && looseIdx < cells.length && looseIdx !== cardedIdx) {
        const imgEl = $(cells[looseIdx]).find('img').first();
        const raw = wikiImageUrlFromCheerioImg(imgEl);
        if (raw) {
          let imgUrl = raw.startsWith('//') ? `https:${raw}` : raw;
          const fullUrl = imgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          try {
            const urlObj = new URL(fullUrl);
            const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const fileName = sanitizedToyNumber
              ? `${sanitizedToyNumber}_loose.${ext}`
              : `${castingSlug}_loose.${ext}`;
            const destPath = path.join(targetFolder, fileName);

            const existingLooseImage = await prisma.image.findFirst({
              where: {
                variantId: variant.id,
                path: {
                  contains: sanitizedToyNumber ? `${sanitizedToyNumber}_loose` : `${castingSlug}_loose`,
                },
              },
            });

            if (isWikiPlaceholderOrMissingImageUrl(fullUrl)) {
              console.warn(`Loose URL is wiki placeholder, skip: ${castingName}`);
            } else if (!existingLooseImage && (await shouldDownloadOrReplaceWikiCachedFile(destPath))) {
              if (fs.existsSync(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
              }
              try {
                await downloadFandomBinary(fullUrl, destPath);
                if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                  await fs.promises.unlink(destPath).catch(() => {});
                  console.warn(`Loose download still placeholder, removed: ${castingName}`);
                } else {
                  downloadCount++;
                  console.log(`Downloaded loose: ${castingName} → ${fileName}`);
                }
              } catch (err) {
                console.error(`Loose download error ${castingName}:`, err);
              }
            }

            if (!existingLooseImage && fs.existsSync(destPath)) {
              const relativePath = `/images/hotwheels/${targetYear}/fast-and-furious/${castingSlug}/${fileName}`;
              if (!(await isLikelyWikiPlaceholderImageFile(destPath))) {
                try {
                  await prisma.image.create({
                    data: {
                      path: relativePath,
                      alt: `${castingName} (Loose)`,
                      variant: { connect: { id: variant.id } },
                    },
                  });
                  associatedCount++;
                  console.log(`Associated loose: ${castingName}`);
                } catch (err) {
                  console.error(`Loose DB error ${castingName}:`, err);
                }
              }
            }
          } catch {
            /* bad URL */
          }
        }
      }
    }
  }

  console.log(`\nDone. ${downloadCount} downloaded, ${associatedCount} DB updates.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
