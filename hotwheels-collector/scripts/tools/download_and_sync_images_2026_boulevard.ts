/**
 * Script to download image assets for the 2026 Hot Wheels Boulevard series.
 * 
 * This script:
 *   1. Fetches the Boulevard table from the Hot Wheels Fandom wiki
 *   2. Extracts Photo Carded and Photo Loose image URLs
 *   3. Downloads images to public/images/hotwheels/2026/boulevard/{castingSlug}/
 *   4. Associates images with Variant records
 * 
 * Boulevard-specific:
 * - Photo Carded: Main image (variant.imageId)
 * - Photo Loose: Second image (variant.images[])
 * - File names: {toyNumber}_carded.jpg and {toyNumber}_loose.jpg
 * - Skips Boxed Set table
 * 
 * How to use:
 *   npx ts-node scripts/tools/download_and_sync_images_2026_boulevard.ts
 *
 * Eski "Image Not Available" / küçük placeholder dosyaları otomatik tespit edilip wiki'den yeniden indirilir.
 * Tüm görselleri zorla yenilemek için: set BOULEVARD_IMAGES_FORCE=1
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import {
  findBoulevardVariantWithColorFallback,
  wikiImageUrlFromCheerioImg,
} from '../lib/boulevard-wiki-images.ts';
import {
  isLikelyWikiPlaceholderImageFile,
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceBoulevardFile,
} from '../lib/wiki-placeholder-image.ts';

const prisma = new PrismaClient();

const targetYear = 2026;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Hot_Wheels_Boulevard`;

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  await fs.promises.mkdir(dir, { recursive: true });
  await downloadFandomBinary(url, dest);
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  let mixName = '';
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim().replace(/\[\]$/, '');
    if (/boxed.*set/i.test(headingText)) return 'Boxed Set';
    const mixMatch = headingText.match(/mix\s*(\d+)/i);
    if (mixMatch) mixName = `Mix ${mixMatch[1]}`;
  }
  if (!mixName) {
    const caption = $(table).find('caption').text().trim();
    if (/boxed.*set/i.test(caption)) return 'Boxed Set';
    const mixMatch = caption.match(/mix\s*(\d+)/i);
    if (mixMatch) mixName = `Mix ${mixMatch[1]}`;
  }
  return mixName || 'Mix 1';
}

async function main() {
  console.log('=== BOULEVARD IMAGE DOWNLOAD SCRIPT STARTED ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`URL: ${WIKI_URL}`);

  console.log(`Fetching ${targetYear} Boulevard page…`);
  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) {
    throw new Error(`Could not locate any tables on the page ${WIKI_URL}`);
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'boulevard');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);

    if (/boxed.*set/i.test(mixName)) {
      console.log(`Skipping ${mixName} table`);
      continue;
    }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Processing ${rows.length} rows from ${mixName}…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      const toyNumberRaw = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const toyNumber = sanitizeFileName(toyNumberRaw);
      const seriesNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const castingNameLink = $(cells[2]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0
        ? castingNameLink.text().trim()
        : $(cells[2]).text().trim();
      const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';

      if (!toyNumber || !seriesNumber || !castingNameRaw) continue;

      const castingName = castingNameRaw;

      const model = await prisma.model.findFirst({
        where: {
          castingName,
          subSeries: {
            name: mixName,
            collection: {
              name: 'Boulevard',
              year: { year: targetYear },
            },
          },
        },
      });

      if (!model) {
        console.warn(`Model not found: ${castingName} (${mixName})`);
        continue;
      }

      const variantWhere: any = {
        modelId: model.id,
        cardNumber: seriesNumber,
        year: targetYear,
      };
      if (bodyColor && bodyColor.trim() !== '') {
        variantWhere.color = bodyColor.trim();
      } else {
        variantWhere.color = null;
      }

      const variant = await findBoulevardVariantWithColorFallback(prisma, variantWhere);
      if (!variant) {
        console.warn(`Variant not found: ${castingName} #${seriesNumber}`);
        continue;
      }

      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      const cardedColIdx = cells.length - 1;
      const looseColIdx = cells.length - 2;

      if (cells.length > cardedColIdx) {
        const cardedImgElement = $(cells[cardedColIdx]).find('img').first();
        const cardedImgUrlRaw = wikiImageUrlFromCheerioImg(cardedImgElement);
        if (cardedImgUrlRaw) {
          let cardedImgUrl = cardedImgUrlRaw.startsWith('//') ? 'https:' + cardedImgUrlRaw : cardedImgUrlRaw;
          let fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(`${fullCardedUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_carded.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          if (isWikiPlaceholderOrMissingImageUrl(fullCardedUrl)) {
            console.warn(`Carded URL is wiki placeholder, skip: ${castingName}`);
            if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
          } else if (await shouldDownloadOrReplaceBoulevardFile(destPath)) {
            if (fs.existsSync(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
            try {
              await downloadImage(fullCardedUrl, destPath);
              if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
                console.warn(`Carded download still placeholder, removed: ${castingName}`);
              } else {
                downloadCount++;
                console.log(`Downloaded carded image: ${castingName} → ${fileName}`);
              }
            } catch (err) {
              console.error(`Error downloading carded image:`, err);
            }
          }

          if (!variant.imageId && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/boulevard/${castingSlug}/${fileName}`;
            try {
              const imageRecord = await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Carded)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              await prisma.variant.update({
                where: { id: variant.id },
                data: { imageId: imageRecord.id },
              });
              associatedCount++;
              console.log(`Associated carded image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating carded image:`, err);
            }
          }
        }
      }

      if (looseColIdx >= 0 && cells.length > looseColIdx) {
        const looseImgElement = $(cells[looseColIdx]).find('img').first();
        const looseImgUrlRaw = wikiImageUrlFromCheerioImg(looseImgElement);
        if (looseImgUrlRaw) {
          let looseImgUrl = looseImgUrlRaw.startsWith('//') ? 'https:' + looseImgUrlRaw : looseImgUrlRaw;
          let fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
          const urlObj = new URL(`${fullLooseUrl}`);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${toyNumber}_loose.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          const existingLooseImage = await prisma.image.findFirst({
            where: { variantId: variant.id, path: { contains: `${toyNumber}_loose` } },
          });

          if (isWikiPlaceholderOrMissingImageUrl(fullLooseUrl)) {
            console.warn(`Loose URL is wiki placeholder, skip: ${castingName}`);
            if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
          } else if (await shouldDownloadOrReplaceBoulevardFile(destPath)) {
            if (fs.existsSync(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
            }
            try {
              await downloadImage(fullLooseUrl, destPath);
              if (await isLikelyWikiPlaceholderImageFile(destPath)) {
                await fs.promises.unlink(destPath).catch(() => {});
                console.warn(`Loose download still placeholder, removed: ${castingName}`);
              } else {
                downloadCount++;
                console.log(`Downloaded loose image: ${castingName} → ${fileName}`);
              }
            } catch (err) {
              console.error(`Error downloading loose image:`, err);
            }
          }

          if (!existingLooseImage && fs.existsSync(destPath)) {
            const relativePath = `/images/hotwheels/${targetYear}/boulevard/${castingSlug}/${fileName}`;
            try {
              await prisma.image.create({
                data: {
                  path: relativePath,
                  alt: `${castingName} (Loose)`,
                  variant: { connect: { id: variant.id } },
                },
              });
              associatedCount++;
              console.log(`Associated loose image with variant ${castingName}`);
            } catch (err) {
              console.error(`Error associating loose image:`, err);
            }
          }
        }
      }
    }
  }

  console.log(
    `\nDownload complete. ${downloadCount} images downloaded, ${associatedCount} images associated.`,
  );
  if (downloadCount === 0 && associatedCount === 0) {
    console.log(
      '(Bilgi) Dosyalar zaten diskte veya variantlarda imageId kayitli olabilir; 0 indirme normal. Eksik onizleme icin app yeniden derleyin.)',
    );
  }
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
