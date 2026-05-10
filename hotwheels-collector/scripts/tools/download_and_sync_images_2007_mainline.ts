/**
 * Download 2007 Mainline images from Fandom and attach to Variant rows by Toy#.
 *
 * Skips Walmart Redline Exclusives and Goodyear Tire Exclusives tables if present (same rules as import).
 *
 *   npx ts-node scripts/tools/download_and_sync_images_2007_mainline.ts
 *
 * Wiki HTML fallback: set FANDOM_WIKI_HTML_PATH to a saved List_of_2007 page (same as import).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { FANDOM_IMAGE_HEADERS, fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();
const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2007_Hot_Wheels';
const TARGET_YEAR = 2007;

function getHeadingContextBeforeTable($table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  let el = $table.prev();
  while (el.length) {
    const tag = el[0]?.tagName?.toLowerCase();
    if (tag === 'table') break;
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      parts.unshift(el.text().trim());
    }
    el = el.prev();
  }
  return parts.join(' | ');
}

function shouldSkipTable($: cheerio.CheerioAPI, $table: cheerio.Cheerio<any>): boolean {
  const ctx = getHeadingContextBeforeTable($table, $);
  if (/Redline\s+Exclusives/i.test(ctx)) return true;
  if (/Goodyear/i.test(ctx)) return true;

  const firstRow = $table.find('tr').first();
  const thText = firstRow.find('th').text().toLowerCase();
  if (thText.length > 0) {
    if (!thText.includes('toy') || !thText.includes('col')) return true;
  }
  return false;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripFandomApiArtefacts(name: string): string {
  return name.replace(/\[\]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeWikiSeriesSpacing(text: string): string {
  return text
    .replace(/([a-z])(?=New in Mainline)/gi, '$1 ')
    .replace(/([a-z])(?=New for)/gi, '$1 ')
    .replace(/([a-z])(?=Faster Than Ever)/gi, '$1 ');
}

function stripThFromSeriesName(raw: string): string {
  return raw
    .replace(/\s*\(?\s*Super\s+Treas(?:ure|ue)\s+Hunt\s*\)?/gi, '')
    .replace(/\s*\(?\s*Treas(?:ure|ue)\s+Hunt\s*\)?/gi, '')
    .replace(/\s*Super\s*$/gi, '')
    .trim();
}

function parseModelNameForImageRow(modelNameRaw: string): { castingName: string; colorVariant: string | null } {
  const variantMatch = modelNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (!variantMatch) {
    return { castingName: modelNameRaw.trim(), colorVariant: null };
  }
  const inner = variantMatch[2].trim();
  if (inner.toLowerCase() === 'mainline') {
    return { castingName: variantMatch[1].trim(), colorVariant: null };
  }
  if (/\d(?:st|nd|rd|th)\s+color/i.test(inner)) {
    return { castingName: variantMatch[1].trim(), colorVariant: inner };
  }
  return { castingName: variantMatch[1].trim(), colorVariant: inner };
}

function imageFileBase(
  toyNumber: string,
  colorVariant: string | null,
  seriesCellText: string,
): string {
  if (colorVariant) {
    return `${toyNumber}-${slugify(colorVariant)}`;
  }
  if (/faster\s+than\s+ever/i.test(seriesCellText)) {
    return `${toyNumber}-fte`;
  }
  return toyNumber;
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: FANDOM_IMAGE_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

async function main() {
  console.log('Fetching 2007 mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);

  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: { year: TARGET_YEAR },
    },
  });

  if (!mainlineCollection) {
    throw new Error('2007 Mainline collection not found. Run import_2007_mainline.ts first.');
  }

  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', String(TARGET_YEAR), 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownloadCount = 0;
  let totalAssociatedCount = 0;

  const tablesArray: cheerio.Cheerio<any>[] = [];
  allTables.each((_index, tableElement) => {
    tablesArray.push($(tableElement));
  });

  for (let tableIndex = 0; tableIndex < tablesArray.length; tableIndex++) {
    const table = tablesArray[tableIndex];

    if (shouldSkipTable($, table)) {
      console.log(`\nSkipping table ${tableIndex + 1} (Redline/Goodyear or non-mainline)`);
      continue;
    }

    const rows = table.find('tbody tr, tr');
    if (rows.length < 2) continue;

    console.log(`\nProcessing table ${tableIndex + 1} (${rows.length} rows)...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;
      if (cells.length < 5) continue;

      const toyNumber = $(cells[0]).text().trim();
      if (!toyNumber) continue;

      const modelNameRaw = $(cells[2]).text().trim();
      const seriesCellRaw = $(cells[3]).text().trim();

      const imgElement = $(cells[cells.length - 1]).find('img').first();
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
      const altText = imgElement.attr('alt') || modelNameRaw;

      if (!imgUrl) continue;

      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }

      let fullImgUrl = imgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

      const { castingName, colorVariant } = parseModelNameForImageRow(modelNameRaw);

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileBase = imageFileBase(toyNumber, colorVariant, seriesCellRaw);
      const fileName = `${fileBase}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      const cleanedSeriesHint = stripFandomApiArtefacts(
        stripThFromSeriesName(normalizeWikiSeriesSpacing(seriesCellRaw))
          .replace(/\s*Walmart Exclusive\s*/gi, '')
          .replace(/\s*Kmart Exclusive\s*/gi, '')
          .replace(/\s*Kroger Exclusive\s*/gi, '')
          .replace(/\s*Target Exclusive\s*/gi, '')
          .replace(/\s*Dollar General Exclusive\s*/gi, '')
          .replace(/\s*GameStop Exclusive\s*/gi, '')
          .replace(/\s*Walgreens Exclusive\s*/gi, '')
          .replace(/\s*Red Edition\s*/gi, '')
          .replace(/\s*New for 2007!\s*/gi, '')
          .replace(/\s*New in Mainline\s*/gi, '')
          .replace(/\s*New for 2007\s*/gi, '')
          .trim(),
      );

      const candidates = await prisma.variant.findMany({
        where: {
          toyNumber,
          year: TARGET_YEAR,
          model: {
            collectionId: mainlineCollection.id,
            castingName,
          },
          color: colorVariant ?? null,
        },
        include: { model: { include: { subSeries: true } } },
      });

      const normCast = (s: string) =>
        s
          .replace(/[''`]/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      let variant = candidates[0];
      if (candidates.length > 1) {
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const hint = norm(cleanedSeriesHint);
        variant =
          candidates.find(v => norm(v.model.subSeries?.name ?? '') === hint) ||
          candidates.find(
            v =>
              norm(v.model.subSeries?.name ?? '').includes(hint) ||
              hint.includes(norm(v.model.subSeries?.name ?? '')),
          ) ||
          candidates[0];
      }

      if (!variant) {
        const loose = await prisma.variant.findMany({
          where: {
            toyNumber,
            year: TARGET_YEAR,
            model: { collectionId: mainlineCollection.id },
            color: colorVariant ?? null,
          },
          include: { model: { include: { subSeries: true } } },
        });
        const targetCast = normCast(castingName);
        variant =
          loose.find(v => normCast(v.model.castingName) === targetCast) ||
          loose.find(v => targetCast.includes(normCast(v.model.castingName))) ||
          loose[0];
      }

      if (!variant) {
        console.warn(`  ⚠️  Variant not found for ${castingName} (Toy#: ${toyNumber}, color: ${colorVariant ?? '—'})`);
        continue;
      }

      if (variant.imageId != null) {
        continue;
      }

      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          totalDownloadCount++;
          console.log(`  Downloaded: ${castingName} → ${fileName}`);
        } catch (err) {
          console.error(`  Error downloading ${fullImgUrl}:`, err);
          continue;
        }
      }

      const relativePath = path
        .join('/images', 'hotwheels', String(TARGET_YEAR), 'mainline', castingSlug, fileName)
        .replace(/\\/g, '/');
      try {
        const imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: altText,
            variant: { connect: { id: variant.id } },
          },
        });
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: imageRecord.id },
        });
        totalAssociatedCount++;
      } catch (err) {
        console.error(`  Error creating image record for ${castingName}:`, err);
      }
    }
  }

  console.log(
    `\n✅ Download complete. ${totalDownloadCount} images downloaded, ${totalAssociatedCount} variants updated.`,
  );
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
