/**
 * Script to import the 2026 Formula One Collection (Hot Wheels Wiki) into the database.
 *
 * This script:
 *   1. Fetches the 2026 Formula One Collection page from Hot Wheels Fandom wiki
 *   2. Parses multiple table types:
 *      - Singles (Mix 1, Mix 2, Future)
 *      - 2-Packs (Mix 1, Future)
 *      - Factory Set
 *      - Other
 *   3. Creates database records: Year → Collection (Formula 1) → SubSeries (type-based) → Model → Variant
 *
 * How to use:
 *   npx ts-node scripts/import/import_2026_formula_1.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const prisma = new PrismaClient();

const targetYear = 2026;
const URL = 'https://hotwheels.fandom.com/wiki/2026_Formula_One_Collection';
const COLLECTION_NAME = 'Formula 1';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHeadingText(s: string): string {
  return (s || '').trim().replace(/\[\]$/, '');
}

function normalizeWhitespace(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
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
  if (h.includes('casting name') && h.includes('driver') && h.includes('wheel type')) return 'singles';
  if (h === 'toy #|name|photo' || (h.includes('toy #') && h.includes('name') && h.includes('photo') && headers.length <= 3))
    return 'twoPacks';
  if (h.includes('cover') && h.includes('inside cover') && h.includes('display') && h.includes('back')) return 'factorySet';
  if (h.includes('casting(s) included') && h.includes('box') && h.includes('display')) return 'other';
  return 'unknown';
}

function extractSectionAndMix($: cheerio.CheerioAPI, table: any): { section: string; mix: string } {
  // Use nearest headings above table to infer section (Singles / 2-Packs / Factory Set / Other) and mix (Mix 1/2/Future).
  const headings = $(table).prevAll('h2, h3, h4').toArray().slice(0, 10);
  let section = '';
  let mix = '';
  for (const h of headings) {
    const t = cleanHeadingText($(h).text());
    if (!t) continue;
    if (!section && /^(singles|2-packs|factory set|other)$/i.test(t)) section = t;
    if (!mix && /^(mix\s*\d+|future)$/i.test(t)) mix = t.replace(/\s+/g, ' ').replace(/^mix\s*/i, 'Mix ');
    if (section && mix) break;
  }
  return { section: section || 'Unknown', mix: mix || '' };
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

async function ensureYearAndCollection(): Promise<{ yearId: number; collectionId: number }> {
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

  return { yearId: yearRecord.id, collectionId: collectionRecord.id };
}

async function getOrCreateSubSeries(collectionId: number, name: string, cache: Map<string, { id: number }>) {
  let sub = cache.get(name);
  if (sub) return sub;
  const existing = await prisma.subSeries.findFirst({ where: { name, collectionId } });
  if (existing) {
    sub = { id: existing.id };
  } else {
    const created = await prisma.subSeries.create({
      data: { name, collection: { connect: { id: collectionId } } },
    });
    console.log(`Created SubSeries: ${name}`);
    sub = { id: created.id };
  }
  cache.set(name, sub);
  return sub;
}

async function main() {
  console.log(`Fetching ${targetYear} Formula One Collection data from ${URL}…`);
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  if (tables.length === 0) throw new Error(`Could not find any tables on ${URL}`);

  const { collectionId } = await ensureYearAndCollection();

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();

  let rowsProcessed = 0;
  let variantsCreated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const headers = headerTextsForTable($, table);
    const kind = detectKind(headers);
    if (kind === 'unknown') continue;

    const { section, mix } = extractSectionAndMix($, table);
    const sectionNorm = normalizeWhitespace(section);

    let subSeriesName = '';
    if (kind === 'singles') {
      subSeriesName = `Singles - ${mix || 'Mix 1'}`;
    } else if (kind === 'twoPacks') {
      subSeriesName = `2-Packs - ${mix || 'Mix 1'}`;
    } else if (kind === 'factorySet') {
      subSeriesName = 'Factory Set';
    } else if (kind === 'other') {
      subSeriesName = 'Other';
    } else {
      subSeriesName = sectionNorm || 'Unknown';
    }

    const subSeries = await getOrCreateSubSeries(collectionId, subSeriesName, subSeriesCache);

    const rows = $(table).find('tbody tr').filter((_: any, r: any) => $(r).find('td').length >= 2);
    if (rows.length === 0) continue;
    console.log(`Processing ${rows.length} row(s) from ${subSeriesName}…`);

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      if (!cells.length) continue;

      if (kind === 'singles') {
        // 0=Toy#, 1=Casting Name, 2=Driver, 3=Wheel Type, 4=Notes, 5=Photo Loose, 6=Photo Carded
        const toyNumber = $(cells[0]).text().trim();
        const castingLink = $(cells[1]).find('a').first();
        const castingName = castingLink.length ? castingLink.text().trim() : $(cells[1]).text().trim();
        const driverLink = $(cells[2]).find('a').first();
        const driver = driverLink.length ? driverLink.text().trim() : $(cells[2]).text().trim();
        const wheelType = $(cells[3]).text().trim();
        const notes = cells.length > 4 ? $(cells[4]).text().trim() : '';
        if (!toyNumber || !castingName) continue;

        const modelKey = `${castingName}__${subSeries.id}`;
        let model = modelCache.get(modelKey);
        if (!model) {
          const existingModel = await prisma.model.findFirst({
            where: { castingName, subSeriesId: subSeries.id, collectionId },
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
                collection: { connect: { id: collectionId } },
                subSeries: { connect: { id: subSeries.id } },
              },
            });
            model = { id: createdModel.id };
            console.log(`Created Model: ${castingName} (${subSeriesName})`);
          }
          modelCache.set(modelKey, model);
        }

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
            releaseName: mix || 'Mix',
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
        continue;
      }

      if (kind === 'twoPacks') {
        // 0=Toy#, 1=Name, 2=Photo
        const toyNumber = $(cells[0]).text().trim();
        const nameLink = $(cells[1]).find('a').first();
        const name = nameLink.length ? nameLink.text().trim() : $(cells[1]).text().trim();
        if (!toyNumber || !name) continue;

        const modelName = name;
        const modelKey = `${modelName}__${subSeries.id}`;
        let model = modelCache.get(modelKey);
        if (!model) {
          const existingModel = await prisma.model.findFirst({
            where: { castingName: modelName, subSeriesId: subSeries.id, collectionId },
          });
          if (existingModel) {
            model = { id: existingModel.id };
          } else {
            // Lightweight: keep metadata empty unless we have a casting page
            let metadata = modelMetadataCache.get(modelName);
            if (!metadata) {
              const href = nameLink.attr('href');
              if (href) {
                const modelUrl = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
                metadata = await fetchModelMetadata(modelUrl);
                modelMetadataCache.set(modelName, metadata);
                await sleep(300);
              } else {
                metadata = { debutSeries: null, produced: null, designer: null, castingNumber: null, description: null };
              }
            }
            const createdModel = await prisma.model.create({
              data: {
                castingName: modelName,
                castingId: toyNumber,
                description: metadata.description,
                debutSeries: metadata.debutSeries,
                produced: metadata.produced,
                designer: metadata.designer,
                castingNumber: metadata.castingNumber,
                collection: { connect: { id: collectionId } },
                subSeries: { connect: { id: subSeries.id } },
              },
            });
            model = { id: createdModel.id };
            console.log(`Created Model: ${modelName} (${subSeriesName})`);
          }
          modelCache.set(modelKey, model);
        }

        const existingVariant = await prisma.variant.findFirst({
          where: { modelId: model.id, year: targetYear, toyNumber },
        });
        if (existingVariant) {
          rowsProcessed++;
          continue;
        }

        await prisma.variant.create({
          data: {
            model: { connect: { id: model.id } },
            year: targetYear,
            releaseName: mix || 'Mix',
            toyNumber,
            notes: sectionNorm && sectionNorm !== 'Unknown' ? `${sectionNorm}` : undefined,
            isTreasureHunt: false,
            isSuperTreasureHunt: false,
            owned: false,
            quantity: 0,
          },
        });
        variantsCreated++;
        rowsProcessed++;
        continue;
      }

      if (kind === 'factorySet') {
        // 0=Toy#, 1=Notes, 2=Cover, 3=Inside Cover, 4=Display, 5=Back
        const toyNumber = $(cells[0]).text().trim();
        const notes = cells.length > 1 ? $(cells[1]).text().trim() : '';
        if (!toyNumber) continue;

        const modelName = 'Formula One Factory Set';
        const modelKey = `${modelName}__${subSeries.id}`;
        let model = modelCache.get(modelKey);
        if (!model) {
          const existingModel = await prisma.model.findFirst({
            where: { castingName: modelName, subSeriesId: subSeries.id, collectionId },
          });
          if (existingModel) {
            model = { id: existingModel.id };
          } else {
            const createdModel = await prisma.model.create({
              data: {
                castingName: modelName,
                castingId: toyNumber,
                description: notes || null,
                collection: { connect: { id: collectionId } },
                subSeries: { connect: { id: subSeries.id } },
              },
            });
            model = { id: createdModel.id };
            console.log(`Created Model: ${modelName} (${subSeriesName})`);
          }
          modelCache.set(modelKey, model);
        }

        const existingVariant = await prisma.variant.findFirst({
          where: { modelId: model.id, year: targetYear, toyNumber },
        });
        if (existingVariant) {
          rowsProcessed++;
          continue;
        }

        await prisma.variant.create({
          data: {
            model: { connect: { id: model.id } },
            year: targetYear,
            releaseName: 'Factory Set',
            toyNumber,
            notes: notes || undefined,
            isTreasureHunt: false,
            isSuperTreasureHunt: false,
            owned: false,
            quantity: 0,
          },
        });
        variantsCreated++;
        rowsProcessed++;
        continue;
      }

      if (kind === 'other') {
        // 0=Toy#, 1=Notes, 2=Casting(s) Included, 3=Box, 4=Display
        const toyNumber = $(cells[0]).text().trim();
        const notes = cells.length > 1 ? $(cells[1]).text().trim() : '';
        const included = cells.length > 2 ? normalizeWhitespace($(cells[2]).text()) : '';
        if (!toyNumber) continue;

        const modelName = notes || 'Formula One Other Set';
        const modelKey = `${modelName}__${subSeries.id}__${toyNumber}`;
        let model = modelCache.get(modelKey);
        if (!model) {
          const existingModel = await prisma.model.findFirst({
            where: { castingName: modelName, subSeriesId: subSeries.id, collectionId, castingId: toyNumber },
          });
          if (existingModel) {
            model = { id: existingModel.id };
          } else {
            const description = [included ? `Included: ${included}` : '', notes ? `Notes: ${notes}` : '']
              .filter(Boolean)
              .join('\n')
              .trim();
            const createdModel = await prisma.model.create({
              data: {
                castingName: modelName,
                castingId: toyNumber,
                description: description || null,
                collection: { connect: { id: collectionId } },
                subSeries: { connect: { id: subSeries.id } },
              },
            });
            model = { id: createdModel.id };
            console.log(`Created Model: ${modelName} (${subSeriesName})`);
          }
          modelCache.set(modelKey, model);
        }

        const existingVariant = await prisma.variant.findFirst({
          where: { modelId: model.id, year: targetYear, toyNumber },
        });
        if (existingVariant) {
          rowsProcessed++;
          continue;
        }

        await prisma.variant.create({
          data: {
            model: { connect: { id: model.id } },
            year: targetYear,
            releaseName: 'Other',
            toyNumber,
            notes: [notes, included ? `Included: ${included}` : ''].filter(Boolean).join('\n') || undefined,
            isTreasureHunt: false,
            isSuperTreasureHunt: false,
            owned: false,
            quantity: 0,
          },
        });
        variantsCreated++;
        rowsProcessed++;
        continue;
      }
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

