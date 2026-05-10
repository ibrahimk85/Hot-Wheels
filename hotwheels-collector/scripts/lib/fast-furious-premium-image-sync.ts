/**
 * Shared wiki row → download carded/loose + Prisma image association for Fast & Furious Premium.
 */

import fs from 'fs';
import path from 'path';
import type { CheerioAPI } from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { PrismaClient } from '@prisma/client';
import { downloadFandomBinary } from './fandom-fetch.ts';
import {
  findBoulevardVariantWithColorFallback,
  wikiImageUrlFromCheerioImg,
} from './boulevard-wiki-images.ts';
import {
  isLikelyWikiPlaceholderImageFile,
  isWikiPlaceholderOrMissingImageUrl,
  shouldDownloadOrReplaceWikiCachedFile,
} from './wiki-placeholder-image.ts';
import { parsePremiumWikiRowForImages } from './fast-furious-premium-wiki-row.ts';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  await downloadFandomBinary(url, dest);
}

export type SyncPremiumRowResult = { downloaded: number; associated: number };

export async function syncFastFuriousPremiumRowImages(
  prisma: PrismaClient,
  $: CheerioAPI,
  cells: Cheerio<any>,
  opts: {
    targetYear: number;
    subSeriesName: string;
    /** From table header; avoids wrong column when wiki column order differs. */
    photoColumnIndices?: { looseIdx: number; cardedIdx: number };
  },
): Promise<SyncPremiumRowResult> {
  let downloaded = 0;
  let associated = 0;
  const { targetYear, subSeriesName, photoColumnIndices } = opts;

  const { toyNumber, collectorNumber, castingName, bodyColor } = parsePremiumWikiRowForImages(
    $,
    cells,
  );
  if (!toyNumber || !collectorNumber || !castingName) {
    return { downloaded, associated };
  }

  const model = await prisma.model.findFirst({
    where: {
      castingName,
      subSeries: {
        name: subSeriesName,
        collection: {
          name: 'Fast & Furious Premium',
          year: { year: targetYear },
        },
      },
    },
  });

  if (!model) {
    console.warn(`Model not found: ${castingName} (${subSeriesName})`);
    return { downloaded, associated };
  }

  const variantWhere = {
    modelId: model.id,
    cardNumber: collectorNumber,
    year: targetYear,
    color: bodyColor && bodyColor.trim() !== '' ? bodyColor.trim() : null,
  };

  const variant = await findBoulevardVariantWithColorFallback(prisma, variantWhere);
  if (!variant) {
    console.warn(`Variant not found: ${castingName} #${collectorNumber}`);
    return { downloaded, associated };
  }

  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    String(targetYear),
    'fast-furious-premium',
  );
  const castingSlug = slugify(castingName);
  const targetFolder = path.join(baseDir, castingSlug);
  await fs.promises.mkdir(targetFolder, { recursive: true });

  const n = cells.length;
  const cardedIdx =
    photoColumnIndices &&
    photoColumnIndices.cardedIdx >= 0 &&
    photoColumnIndices.cardedIdx < n
      ? photoColumnIndices.cardedIdx
      : n - 1;
  const looseIdx =
    photoColumnIndices &&
    photoColumnIndices.looseIdx >= 0 &&
    photoColumnIndices.looseIdx < n
      ? photoColumnIndices.looseIdx
      : n - 2;

  if (cardedIdx >= 0) {
    const cardedImgElement = $(cells[cardedIdx]).find('img').first();
    const cardedImgUrlRaw = wikiImageUrlFromCheerioImg(cardedImgElement);
    if (cardedImgUrlRaw) {
      let cardedImgUrl = cardedImgUrlRaw;
      if (cardedImgUrl.startsWith('//')) {
        cardedImgUrl = 'https:' + cardedImgUrl;
      }
      const fullCardedUrl = cardedImgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

      try {
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
        } else if (await shouldDownloadOrReplaceWikiCachedFile(destPath)) {
          if (fs.existsSync(destPath)) {
            await fs.promises.unlink(destPath).catch(() => {});
          }
          try {
            await downloadImage(fullCardedUrl, destPath);
            if (await isLikelyWikiPlaceholderImageFile(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
              console.warn(`Carded download still placeholder, removed: ${castingName}`);
            } else {
              downloaded++;
              console.log(`Downloaded carded image: ${castingName} → ${fileName}`);
            }
          } catch (err) {
            console.error(`Error downloading carded image:`, err);
          }
        }

        const relativePath = `/images/hotwheels/${targetYear}/fast-furious-premium/${castingSlug}/${fileName}`;
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
              associated++;
              console.log(`Created carded image record: ${castingName}`);
            }
            if (variant.imageId !== imageRecord.id) {
              await prisma.variant.update({
                where: { id: variant.id },
                data: { imageId: imageRecord.id },
              });
              associated++;
              console.log(`Set variant.imageId to carded: ${castingName}`);
            }
          } catch (err) {
            console.error(`Error associating carded image:`, err);
          }
        }
      } catch {
        /* invalid carded URL */
      }
    }
  }

  if (looseIdx >= 0 && looseIdx !== cardedIdx) {
    const looseImgElement = $(cells[looseIdx]).find('img').first();
    const looseImgUrlRaw = wikiImageUrlFromCheerioImg(looseImgElement);
    if (looseImgUrlRaw) {
      let looseImgUrl = looseImgUrlRaw;
      if (looseImgUrl.startsWith('//')) {
        looseImgUrl = 'https:' + looseImgUrl;
      }
      const fullLooseUrl = looseImgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

      try {
        const urlObj = new URL(`${fullLooseUrl}`);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `${toyNumber}_loose.${ext}`;
        const destPath = path.join(targetFolder, fileName);

        const existingLooseImage = await prisma.image.findFirst({
          where: {
            variantId: variant.id,
            path: { contains: `${toyNumber}_loose` },
          },
        });

        if (isWikiPlaceholderOrMissingImageUrl(fullLooseUrl)) {
          console.warn(`Loose URL is wiki placeholder, skip: ${castingName}`);
          if (fs.existsSync(destPath) && (await isLikelyWikiPlaceholderImageFile(destPath))) {
            await fs.promises.unlink(destPath).catch(() => {});
          }
        } else if (await shouldDownloadOrReplaceWikiCachedFile(destPath)) {
          if (fs.existsSync(destPath)) {
            await fs.promises.unlink(destPath).catch(() => {});
          }
          try {
            await downloadImage(fullLooseUrl, destPath);
            if (await isLikelyWikiPlaceholderImageFile(destPath)) {
              await fs.promises.unlink(destPath).catch(() => {});
              console.warn(`Loose download still placeholder, removed: ${castingName}`);
            } else {
              downloaded++;
              console.log(`Downloaded loose image: ${castingName} → ${fileName}`);
            }
          } catch (err) {
            console.error(`Error downloading loose image:`, err);
          }
        }

        if (!existingLooseImage && fs.existsSync(destPath)) {
          const relativePath = `/images/hotwheels/${targetYear}/fast-furious-premium/${castingSlug}/${fileName}`;
          try {
            await prisma.image.create({
              data: {
                path: relativePath,
                alt: `${castingName} (Loose)`,
                variant: { connect: { id: variant.id } },
              },
            });
            associated++;
            console.log(`Associated loose image with variant ${castingName}`);
          } catch (err) {
            console.error(`Error associating loose image:`, err);
          }
        }
      } catch {
        /* invalid loose URL */
      }
    }
  }

  return { downloaded, associated };
}
