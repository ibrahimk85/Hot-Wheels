/**
 * Script to import the 2022 Hot Wheels Silver Series - Blue and Pink set into your database.
 *
 * This script:
 *   1. Fetches the Blue and Pink Series (2022) page from Hot Wheels Fandom wiki
 *   2. Parses Mix 1 and Mix 2 tables
 *   3. Extracts: Col#, Toy#, Casting Name, Color, Wheel Type, Notes
 *   4. Creates: Year → Collection (Hot Wheels Silver Series) → SubSeries (category=Anniversary) → Model → Variant
 *
 * Table columns: Col# | Toy# | Casting Name | Color | Tampo | Wheel Type | Notes | Photo Loose | Photo Carded
 *
 * How to use:
 *   npx ts-node scripts/import/import_2022_silver_series_blue_and_pink.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2022;
const URL = 'https://hotwheels.fandom.com/wiki/Blue_and_Pink_Series_(2022)';
const COLLECTION_NAME = 'Hot Wheels Silver Series';
const SERIES_NAME = 'Blue and Pink (2022)';
const CATEGORY = 'Anniversary';

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
    const response = await fetch(modelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) {
      return {
        debutSeries: null,
        produced: null,
        designer: null,
        castingNumber: null,
        description: null,
      };
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    let description: string | null = null;
    const infobox = $('.infobox, .wikitable').first();
    if (infobox.length > 0) {
      infobox.find('tr').each((_: any, row: any) => {
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
  } catch {
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
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const text = prevHeading.text().trim().replace(/\[\]$/, '');
    if (!/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(text)) {
      return text;
    }
  }
  const caption = $(table).find('caption').text().trim().replace(/\[\]$/, '');
  if (caption) return caption;
  return 'Unknown Mix';
}

function parseRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>): {
  colNumber: string;
  toyNumber: string;
  castingName: string;
  color: string;
  wheelType: string;
  notes: string;
  castingNameLink: ReturnType<typeof $>;
} {
  const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
  const toyNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0
    ? castingNameLink.text().trim()
    : cells.length > 2 ? $(cells[2]).text().trim() : '';
  const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
  const wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
  const notes = cells.length > 6 ? $(cells[6]).text().trim() : '';
  return { colNumber, toyNumber, castingName, color, wheelType, notes, castingNameLink };
}

async function main() {
  console.log(`Fetching Blue and Pink Series (${targetYear}) from ${URL}…`);
  const response = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
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

  let collectionRecord = await prisma.collection.findFirst({
    where: { name: COLLECTION_NAME, yearId: yearRecord.id },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: COLLECTION_NAME,
        code: 'Silver Series',
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for ${COLLECTION_NAME}`);
  }

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();
  let totalProcessed = 0;
  let totalCreated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const mixName = extractMixName($, table);
    const subSeriesName = `${SERIES_NAME} - ${mixName}`;

    if (/^(contents|references|see also|external links|categories|vehicles|gallery)$/i.test(mixName)) {
      console.log(`Skipping table with name: ${mixName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length < 3) continue;

      const parsed = parseRow($, cells);
      if (!parsed.toyNumber || !parsed.castingName) {
        console.warn(`Skipping row: Toy#=${parsed.toyNumber}, Name=${parsed.castingName}`);
        continue;
      }

      const { colNumber, toyNumber, castingName, color, wheelType, notes, castingNameLink } = parsed;

      let subSeries = subSeriesCache.get(subSeriesName);
      if (!subSeries) {
        const existingSub = await prisma.subSeries.findFirst({
          where: { name: subSeriesName, collectionId: collectionRecord!.id },
        });
        if (existingSub) {
          subSeries = { id: existingSub.id };
        } else {
          const created = await prisma.subSeries.create({
            data: {
              name: subSeriesName,
              category: CATEGORY,
              collection: { connect: { id: collectionRecord!.id } },
            },
          });
          console.log(`Created SubSeries: ${subSeriesName} (category: ${CATEGORY})`);
          subSeries = { id: created.id };
        }
        subSeriesCache.set(subSeriesName, subSeries);
      }

      const modelKey = `${castingName}_${subSeriesName}`;
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
              toyNumber,
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
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: colNumber || undefined,
          color: color || undefined,
          year: targetYear,
        },
      });
      if (existingVariant) continue;

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: subSeriesName,
          color: color || undefined,
          cardNumber: colNumber || undefined,
          toyNumber,
          wheelType: wheelType || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: notes || undefined,
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
