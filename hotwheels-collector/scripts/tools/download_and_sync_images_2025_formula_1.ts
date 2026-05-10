/**
 * Download & associate images for 2025 Formula 1 (Formula One Collection).
 *
 * - Source: https://hotwheels.fandom.com/wiki/2025_Formula_One_Collection
 * - Singles tables include Photo Loose + Photo Carded.
 * - Carded is treated as the main image (variant.imageId); loose is added to variant.images[].
 *
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2025_formula_1.ts
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
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceWikiCachedFile,
  isLikelyWikiPlaceholderImageFile,
} from '../lib/wiki-placeholder-image.ts';

const prisma = new PrismaClient();

const targetYear = 2025;
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/2025_Formula_One_Collection';
const COLLECTION_NAME = 'Formula 1';
const BASE_SUBDIR = 'formula-1/singles';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
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

async function main() {
  console.log('=== FORMULA 1 (2025) IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);

  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);

  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    targetYear.toString(),
    ...BASE_SUBDIR.split('/'),
  );
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const header = $(table).find('tr').first().text().toLowerCase();
    if (!header.includes('toy') || !header.includes('casting name') || !header.includes('photo')) continue;

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 5);
    if (rows.length === 0) continue;
    console.log(`Processing ${rows.length} row(s) from Singles table #${tableIdx + 1}…`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      const toyNumber = sanitizeFileName($(cells[0]).text().trim());
      const castingLink = $(cells[1]).find('a').first();
      const castingName = castingLink.length ? castingLink.text().trim() : $(cells[1]).text().trim();

      if (!toyNumber || !castingName) continue;

      const variant = await prisma.variant.findFirst({
        where: {
          year: targetYear,
          toyNumber,
          model: {
            collection: { name: COLLECTION_NAME, year: { year: targetYear } },
          },
        },
        include: { model: true, images: true },
      });

      if (!variant) {
        console.warn(`Variant not found for Toy# ${toyNumber} (${castingName}); skipping images.`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Columns: ... Notes, Photo Loose, Photo Carded
      const cardedColIdx = cells.length - 1;
      const looseColIdx = cells.length - 2;

      for (const [idx, kind] of [
        [cardedColIdx, 'carded'] as const,
        [looseColIdx, 'loose'] as const,
      ]) {
        if (idx < 0 || idx >= cells.length) continue;
        const imgEl = $(cells[idx]).find('img').first();
        const rawUrl = wikiImageUrlFromCheerioImg(imgEl);
        if (!rawUrl) continue;

        const cleaned = cleanCdnUrl(rawUrl);
        if (isWikiPlaceholderOrMissingImageUrl(cleaned)) continue;

        const extMatch = new URL(cleaned).pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `${toyNumber}_${kind}.${ext}`;
        const destPath = path.join(targetFolder, fileName);
        const relPath = `/images/hotwheels/${targetYear}/${BASE_SUBDIR}/${castingSlug}/${fileName}`;

        if (await shouldDownloadOrReplaceWikiCachedFile(destPath)) {
          if (fs.existsSync(destPath)) await fs.promises.unlink(destPath).catch(() => {});
          try {
            await downloadImage(cleaned, destPath);
            if (await isLikelyWikiPlaceholderImageFile(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
            } else {
              downloadCount++;
              console.log(`Downloaded ${kind}: ${castingName} → ${fileName}`);
            }
          } catch (e) {
            console.error(`Download failed (${kind}) for ${castingName}:`, e);
          }
        }

        if (!fs.existsSync(destPath)) continue;

        if (kind === 'carded') {
          if (!variant.imageId) {
            try {
              const imageRecord = await prisma.image.create({
                data: {
                  path: relPath,
                  alt: `${castingName} (Carded)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              await prisma.variant.update({ where: { id: variant.id }, data: { imageId: imageRecord.id } });
              associatedCount++;
              console.log(`Associated carded as main image: ${castingName}`);
            } catch (e) {
              console.error(`Associate failed (carded) for ${castingName}:`, e);
            }
          }
        } else {
          const existingLoose = await prisma.image.findFirst({
            where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } },
          });
          if (!existingLoose) {
            try {
              await prisma.image.create({
                data: {
                  path: relPath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated loose image: ${castingName}`);
            } catch (e) {
              console.error(`Associate failed (loose) for ${castingName}:`, e);
            }
          }
        }
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

