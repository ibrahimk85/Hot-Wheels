/**
 * Download Fast & Furious Premium wiki images for 2019 (403-safe fetch + CDN binary download).
 *
 *   npx ts-node scripts/tools/download_and_sync_images_2019_fast_furious_premium.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import { syncFastFuriousPremiumRowImages } from '../lib/fast-furious-premium-image-sync.ts';
import {
  extractFastFuriousPremiumSubSeriesName,
  getFastFuriousPremiumPhotoColumnIndices,
} from '../lib/fast-furious-premium-wiki-row.ts';

const prisma = new PrismaClient();
const targetYear = 2019;
const WIKI_URL = `https://hotwheels.fandom.com/wiki/${targetYear}_Fast_%26_Furious_Premium_Series`;

async function main() {
  console.log('=== FAST & FURIOUS PREMIUM IMAGE DOWNLOAD ===');
  console.log(`Year: ${targetYear}  URL: ${WIKI_URL}`);

  const html = await fetchFandomWikiHtml(WIKI_URL);
  const $ = cheerio.load(html);

  const allTables = $('table.wikitable');
  const yearTables = allTables.filter((_, table) => {
    const headingText = extractFastFuriousPremiumSubSeriesName($, table);
    if (/boxed set/i.test(headingText)) return false;
    return true;
  });

  if (yearTables.length === 0) {
    throw new Error(`No tables for ${targetYear} on ${WIKI_URL}`);
  }

  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    String(targetYear),
    'fast-furious-premium',
  );
  await fs.promises.mkdir(baseDir, { recursive: true });

  let downloadCount = 0;
  let associatedCount = 0;

  for (let tableIdx = 0; tableIdx < yearTables.length; tableIdx++) {
    const table = yearTables[tableIdx];
    const subSeriesName = extractFastFuriousPremiumSubSeriesName($, table);
    const photoColumnIndices = getFastFuriousPremiumPhotoColumnIndices($, table);

    if (/^(contents|references|see also|external links|categories|boxed set)$/i.test(subSeriesName)) {
      console.log(`Skipping: ${subSeriesName}`);
      continue;
    }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      return $(row).find('td').length >= 3;
    });

    console.log(`Processing ${rows.length} rows — ${subSeriesName}`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (cells.length === 0) continue;
      const r = await syncFastFuriousPremiumRowImages(prisma, $, cells, {
        targetYear,
        subSeriesName,
        photoColumnIndices,
      });
      downloadCount += r.downloaded;
      associatedCount += r.associated;
    }
  }

  console.log(`\nDone. ${downloadCount} downloaded, ${associatedCount} associated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
