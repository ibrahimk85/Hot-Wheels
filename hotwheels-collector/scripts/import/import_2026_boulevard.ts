/**
 * Script to import the 2026 Hot Wheels Boulevard set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2026 Boulevard page from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (Mix 1, Mix 2, Mix 3)
 *   3. Extracts data: Toy #, Series #, Casting Name, Body Color, Wheel Type, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Boulevard) → SubSeries (Mix 1-3) → Model → Variant
 *
 * Boulevard-specific:
 * - No TH/STH (always false)
 * - SubSeries are Mix 1, Mix 2, Mix 3 (2026 has 3 mixes)
 * - Skips Boxed Set table
 *
 * How to use:
 *   npx ts-node scripts/import/import_2026_boulevard.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const targetYear = 2026;
const URL = 'https://hotwheels.fandom.com/wiki/2026_Hot_Wheels_Boulevard';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchModelMetadata(modelUrl: string): Promise<{
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
  description: string | null;
}> {
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
      infobox.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
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
  } catch (error) {
    return {
      debutSeries: null,
      produced: null,
      designer: null,
      castingNumber: null,
      description: null,
    };
  }
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  let mixName = '';
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim().replace(/\[\]$/, '');
    if (/boxed.*set/i.test(headingText)) {
      return 'Boxed Set';
    }
    const mixMatch = headingText.match(/mix\s*(\d+)/i);
    if (mixMatch) {
      mixName = `Mix ${mixMatch[1]}`;
    }
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
  console.log(`Fetching ${targetYear} Boulevard data from ${URL}…`);
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s). Processing…`);

  if (tables.length === 0) {
    throw new Error(`Could not find any tables on the page ${URL}`);
  }

  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  const collectionName = 'Boulevard';
  let collectionRecord = await prisma.collection.findFirst({
    where: { name: collectionName, yearId: yearRecord.id },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: collectionName,
        code: collectionName,
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for ${collectionName}`);
  }

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();
  let totalProcessed = 0;
  let totalCreated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);

    if (/boxed.*set/i.test(mixName)) {
      console.log(`Skipping ${mixName} table`);
      continue;
    }

    console.log(`\nProcessing ${mixName}…`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Found ${rows.length} rows in ${mixName}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      const toyNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const seriesNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const castingNameLink = $(cells[2]).find('a').first();
      const castingNameRaw = castingNameLink.length > 0
        ? castingNameLink.text().trim()
        : $(cells[2]).text().trim();
      const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const wheelType = cells.length > 4 ? $(cells[4]).text().trim() : '';
      const notes = cells.length > 5 ? $(cells[5]).text().trim() : '';

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        console.warn(`Skipping row: Toy#=${toyNumber}, Series#=${seriesNumber}, Name=${castingNameRaw}`);
        continue;
      }

      const castingName = castingNameRaw;

      let subSeries = subSeriesCache.get(mixName);
      if (!subSeries) {
        const existingSub = await prisma.subSeries.findFirst({
          where: { name: mixName, collectionId: collectionRecord!.id },
        });
        if (existingSub) {
          subSeries = { id: existingSub.id };
        } else {
          const created = await prisma.subSeries.create({
            data: { name: mixName, collection: { connect: { id: collectionRecord!.id } } },
          });
          console.log(`Created SubSeries: ${mixName}`);
          subSeries = { id: created.id };
        }
        subSeriesCache.set(mixName, subSeries);
      }

      const modelKey = `${castingName}_${mixName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: { castingName, subSeriesId: subSeries.id },
        });
        if (existingModel) {
          model = { id: existingModel.id };
        } else {
          let metadata = modelMetadataCache.get(castingName);
          if (!metadata) {
            const modelPageHref = castingNameLink.attr('href');
            if (modelPageHref) {
              const modelUrl = modelPageHref.startsWith('http')
                ? modelPageHref
                : `https://hotwheels.fandom.com${modelPageHref}`;
              console.log(`Fetching metadata for ${castingName}...`);
              metadata = await fetchModelMetadata(modelUrl);
              modelMetadataCache.set(castingName, metadata);
              await sleep(500);
            } else {
              metadata = { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
            }
          }
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber,
              description: metadata.description,
              debutSeries: metadata.debutSeries,
              produced: metadata.produced,
              designer: metadata.designer,
              castingNumber: metadata.castingNumber,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${mixName})`);
        }
        modelCache.set(modelKey, model);
      }

      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: seriesNumber,
          color: bodyColor || undefined,
          year: targetYear,
        },
      });
      if (existingVariant) continue;

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: mixName,
          color: bodyColor || undefined,
          cardNumber: seriesNumber,
          wheelType: wheelType || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: notes || undefined,
          owned: false,
          quantity: 0,
        },
      });
      totalCreated++;
      totalProcessed++;
    }
  }

  console.log(`\nImport completed. Processed ${totalProcessed} rows, created ${totalCreated} new variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
