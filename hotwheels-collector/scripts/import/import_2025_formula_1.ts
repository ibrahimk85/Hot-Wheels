/**
 * Script to import the 2025 Formula One Collection (Hot Wheels Wiki) into the database.
 *
 * This script:
 *   1. Fetches the 2025 Formula One Collection page from Hot Wheels Fandom wiki
 *   2. Parses Singles tables (Mix 1, Mix 2, Mix 3)
 *   3. Extracts data: Toy #, Casting Name, Driver, Wheel Type, Notes
 *   4. Fetches model detail pages to get: Debut Series, Produced, Designer, Number, Description
 *   5. Creates database records: Year → Collection (Formula 1) → SubSeries (Singles - Mix X) → Model → Variant
 *
 * How to use:
 *   npx ts-node scripts/import/import_2025_formula_1.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();

const targetYear = 2025;
const URL = 'https://hotwheels.fandom.com/wiki/2025_Formula_One_Collection';
const COLLECTION_NAME = 'Formula 1';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHeadingText(s: string): string {
  return (s || '').trim().replace(/\[\]$/, '');
}

function extractMixName($: cheerio.CheerioAPI, table: any): string {
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const t = cleanHeadingText(prevHeading.text());
    if (!/^(contents|references|see also|external links|categories|gallery)$/i.test(t)) {
      const mixMatch = t.match(/mix\s*(\d+)/i);
      if (mixMatch) return `Mix ${mixMatch[1]}`;
      return t;
    }
  }
  const caption = cleanHeadingText($(table).find('caption').text());
  if (caption) return caption;
  return 'Mix 1';
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

async function main() {
  console.log(`Fetching ${targetYear} Formula One Collection data from ${URL}…`);
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not find any tables on ${URL}`);

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
        code: COLLECTION_NAME,
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for ${COLLECTION_NAME} (${targetYear})`);
  }

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();

  let rowsProcessed = 0;
  let variantsCreated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const headerText = $(table).find('th').first().text().trim().toLowerCase();
    // Only process Singles-style tables
    if (!headerText.includes('toy')) continue;

    const mixName = extractMixName($, table);
    const subSeriesName = `Singles - ${mixName}`;

    let subSeries = subSeriesCache.get(subSeriesName);
    if (!subSeries) {
      const existingSub = await prisma.subSeries.findFirst({
        where: { name: subSeriesName, collectionId: collectionRecord.id },
      });
      if (existingSub) {
        subSeries = { id: existingSub.id };
      } else {
        const created = await prisma.subSeries.create({
          data: { name: subSeriesName, collection: { connect: { id: collectionRecord.id } } },
        });
        console.log(`Created SubSeries: ${subSeriesName}`);
        subSeries = { id: created.id };
      }
      subSeriesCache.set(subSeriesName, subSeries);
    }

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 4);
    if (rows.length === 0) continue;
    console.log(`Processing ${rows.length} row(s) from ${subSeriesName}…`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      // Expected columns: 0=Toy#, 1=Casting Name, 2=Driver, 3=Wheel Type, 4=Notes, 5=Photo Loose, 6=Photo Carded
      const toyNumber = $(cells[0]).text().trim();
      const castingLink = $(cells[1]).find('a').first();
      const castingName = castingLink.length ? castingLink.text().trim() : $(cells[1]).text().trim();
      const driverLink = $(cells[2]).find('a').first();
      const driver = driverLink.length ? driverLink.text().trim() : $(cells[2]).text().trim();
      const wheelType = $(cells[3]).text().trim();
      const notes = cells.length > 4 ? $(cells[4]).text().trim() : '';

      if (!toyNumber || !castingName) continue;

      // Model
      const modelKey = `${castingName}__${subSeries.id}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName,
            subSeriesId: subSeries.id,
            collectionId: collectionRecord.id,
          },
        });
        if (existingModel) {
          model = { id: existingModel.id };
        } else {
          let metadata = modelMetadataCache.get(castingName);
          if (!metadata) {
            const href = castingLink.attr('href');
            if (href) {
              const modelUrl = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
              console.log(`Fetching metadata for ${castingName}…`);
              metadata = await fetchModelMetadata(modelUrl);
              modelMetadataCache.set(castingName, metadata);
              await sleep(400);
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
              collection: { connect: { id: collectionRecord.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${castingName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Variant (unique by toyNumber per plan)
      const existingVariant = await prisma.variant.findFirst({
        where: { modelId: model.id, year: targetYear, toyNumber },
      });
      if (existingVariant) {
        rowsProcessed++;
        continue;
      }

      const combinedNotes = [notes?.trim(), driver?.trim() ? `Driver: ${driver.trim()}` : '']
        .filter(Boolean)
        .join('\n')
        .trim();

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: mixName,
          toyNumber,
          wheelType: wheelType || undefined,
          notes: combinedNotes || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          owned: false,
          quantity: 0,
        },
      });
      variantsCreated++;
      rowsProcessed++;
    }
  }

  console.log(`\nImport completed. Processed ${rowsProcessed} row(s), created ${variantsCreated} new variant(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

