/**
 * Script to import the 2007 Hot Wheels Mainline set into your database using Prisma.
 *
 * Fetches ALL mainline tables from the 2007 Fandom wiki page (multi-table layout):
 * 2007 New Models, Segment Series, Code Cars, Track Stars, Treasure Hunt (wiki TOC typo "Treasue Hunt"),
 * All Stars, Mystery Cars.
 * Skips Walmart "Redline Exclusives" and "Goodyear Tire Exclusives" if present (same rules as 2008/2009).
 *
 * IMPORTANT: Same Toy# can repeat for 2nd/3rd/4th Color (same COL#). Variants dedupe by
 * (modelId, toyNumber, year, color). FTE rows may share Toy# with base but differ by SubSeries/model.
 *
 *   npx ts-node scripts/import/import_2007_mainline.ts
 *
 * If Fandom returns 403, save the wiki page as HTML in your browser and run with:
 *   set FANDOM_WIKI_HTML_PATH=C:\path\to\page.html
 *   npm run import:mainline:2007
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';

const URL = 'https://hotwheels.fandom.com/wiki/List_of_2007_Hot_Wheels';
const prisma = new PrismaClient();

interface TableInfo {
  heading: string | null;
  headingContext: string;
  table: cheerio.Cheerio<any>;
  subSeriesName: string;
}

/** Insert spaces before fused wiki tokens, e.g. "Track StarsNew in Mainline" */
function normalizeWikiSeriesSpacing(text: string): string {
  return text
    .replace(/([a-z])(?=New in Mainline)/gi, '$1 ')
    .replace(/([a-z])(?=New for)/gi, '$1 ')
    .replace(/([a-z])(?=Faster Than Ever)/gi, '$1 ');
}

/** MediaWiki API HTML sometimes leaves `[]` in headings/cells */
function stripFandomApiArtefacts(name: string): string {
  return name.replace(/\[\]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Must remove Super Treasure Hunt before Treasure Hunt or "Super" is left over.
 * 2007 wiki section title sometimes misspells "Treasure" as "Treasue".
 */
function stripThFromSeriesName(raw: string): string {
  return raw
    .replace(/\s*\(?\s*Super\s+Treas(?:ure|ue)\s+Hunt\s*\)?/gi, '')
    .replace(/\s*\(?\s*Treas(?:ure|ue)\s+Hunt\s*\)?/gi, '')
    .replace(/\s*Super\s*$/gi, '')
    .trim();
}

/** Walk backwards to previous table; collect h2/h3/h4 text for skip rules */
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
  if (/Redline\s+Exclusives/i.test(ctx)) {
    console.log(`  Skipping table (Walmart Redline Exclusives — duplicates main list)`);
    return true;
  }
  if (/Goodyear/i.test(ctx)) {
    console.log(`  Skipping table (Goodyear Tire Exclusives — noted as 2010 release on wiki)`);
    return true;
  }

  const firstRow = $table.find('tr').first();
  const thText = firstRow.find('th').text().toLowerCase();
  if (thText.length > 0) {
    if (!thText.includes('toy') || !thText.includes('col')) {
      console.log(`  Skipping table (header row not a mainline Toy/Col table)`);
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('Fetching 2007 mainline data…');
  const html = await fetchFandomWikiHtml(URL);
  const $ = cheerio.load(html);

  const targetYear = 2007;
  let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: targetYear } });
    console.log(`Created Year record for ${targetYear}`);
  }

  const collectionName = 'Mainline';
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

  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  const tablesToProcess: TableInfo[] = [];

  allTables.each((index, tableElement) => {
    const $table = $(tableElement);

    if (shouldSkipTable($, $table)) {
      return;
    }

    let heading: string | null = null;
    let currentElement = $table.prev();
    for (let i = 0; i < 5; i++) {
      if (currentElement.length === 0) break;
      const tagName = currentElement[0]?.tagName?.toLowerCase();
      if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        heading = stripFandomApiArtefacts(currentElement.text().trim());
        break;
      }
      currentElement = currentElement.prev();
    }

    const headingContext = getHeadingContextBeforeTable($table, $);
    let subSeriesName = heading || `Table ${index + 1}`;

    const rows = $table.find('tbody tr, tr');
    if (rows.length < 2) {
      console.log(`  Skipping table ${index + 1} (too few rows: ${rows.length})`);
      return;
    }

    const firstDataRow = rows.eq(1);
    const cells = firstDataRow.find('td');
    if (cells.length < 5) {
      console.log(`  Skipping table ${index + 1} (not enough columns: ${cells.length})`);
      return;
    }

    if (cells.length >= 4) {
      const seriesCell = stripFandomApiArtefacts(
        normalizeWikiSeriesSpacing(cells.eq(3).text().trim()),
      );
      if (seriesCell && seriesCell.length > 0) {
        subSeriesName = stripThFromSeriesName(seriesCell);
      }
    }

    if (!subSeriesName || subSeriesName === `Table ${index + 1}`) {
      subSeriesName = heading || `Table ${index + 1}`;
    }
    subSeriesName = stripFandomApiArtefacts(subSeriesName);

    tablesToProcess.push({
      heading,
      headingContext,
      table: $table,
      subSeriesName,
    });

    console.log(`  Table ${index + 1}: "${subSeriesName}" (${rows.length} rows, heading: ${heading || 'none'})`);
  });

  console.log(`\nProcessing ${tablesToProcess.length} tables...\n`);

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();

  for (const tableInfo of tablesToProcess) {
    const { subSeriesName, table } = tableInfo;
    console.log(`\n📋 Processing table: ${subSeriesName}`);

    const rows = table.find('tbody tr, tr');
    console.log(`  Found ${rows.length} rows`);

    let processedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;
      if (cells.length < 5) continue;

      const toyNumber = $(cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue;

      const collectorNumberStr = $(cells[1]).text().trim();
      const collectorNumber = collectorNumberStr === '' ? null : parseInt(collectorNumberStr, 10);
      const modelNameRaw = $(cells[2]).text().trim();
      const subSeriesNameRaw = stripFandomApiArtefacts(
        normalizeWikiSeriesSpacing($(cells[3]).text().trim()),
      );
      const seriesInfoRaw = stripFandomApiArtefacts($(cells[4] || cells[3]).text().trim());

      let cleanedSubSeriesName = stripThFromSeriesName(subSeriesNameRaw)
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
        .trim();

      cleanedSubSeriesName = stripFandomApiArtefacts(cleanedSubSeriesName);

      let finalSubSeriesName =
        cleanedSubSeriesName && cleanedSubSeriesName.length > 0 ? cleanedSubSeriesName : subSeriesName;
      if (/^super$/i.test(finalSubSeriesName)) {
        finalSubSeriesName = subSeriesName;
      }
      finalSubSeriesName = stripFandomApiArtefacts(finalSubSeriesName);

      let castingName = modelNameRaw;
      let variantDescription: string | null = null;
      const variantMatch = modelNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (variantMatch) {
        castingName = variantMatch[1].trim();
        const parsedDescription = variantMatch[2].trim();
        if (parsedDescription.toLowerCase() !== 'mainline') {
          variantDescription = parsedDescription;
        }
      }

      const combinedText = `${subSeriesNameRaw} ${seriesInfoRaw}`;
      const isSuperTreasureHunt = /Super\s+Treas(?:ure|ue)\s+Hunt/i.test(combinedText);
      const isTreasureHunt =
        !isSuperTreasureHunt && /Treas(?:ure|ue)\s+Hunt/i.test(combinedText);
      const isRedEdition = /Red Edition/i.test(combinedText);
      const isTargetExclusive = /Target Exclusive/i.test(combinedText);
      const isWalmartExclusive = /Walmart Exclusive/i.test(combinedText);
      const isKrogerExclusive = /Kroger Exclusive/i.test(combinedText);
      const isKmartExclusive = /Kmart Exclusive/i.test(combinedText);
      const isNewFor2007 = /New for 2007/i.test(combinedText);

      let seriesRatio: string | null = null;
      const ratioMatch = seriesInfoRaw.match(/(\d+\/\d+)/);
      if (ratioMatch) {
        seriesRatio = ratioMatch[1];
      }

      const notesParts: string[] = [];
      if (isNewFor2007) notesParts.push('New for 2007');
      if (isTreasureHunt) notesParts.push('Treasure Hunt');
      if (isSuperTreasureHunt) notesParts.push('Super Treasure Hunt');
      if (isRedEdition) notesParts.push('Red Edition');
      if (isTargetExclusive) notesParts.push('Target Exclusive');
      if (isWalmartExclusive) notesParts.push('Walmart Exclusive');
      if (isKrogerExclusive) notesParts.push('Kroger Exclusive');
      if (isKmartExclusive) notesParts.push('Kmart Exclusive');
      if (seriesRatio) notesParts.push(`Series ratio ${seriesRatio}`);

      let colorVariant: string | null = null;
      if (variantDescription) {
        colorVariant = variantDescription;
      }
      const notes = notesParts.join('; ');

      let finalSubSeries = subSeriesCache.get(finalSubSeriesName);
      if (!finalSubSeries) {
        const existingSub = await prisma.subSeries.findFirst({
          where: {
            name: finalSubSeriesName,
            collectionId: collectionRecord!.id,
          },
        });
        if (existingSub) {
          finalSubSeries = { id: existingSub.id };
        } else {
          const created = await prisma.subSeries.create({
            data: {
              name: finalSubSeriesName,
              collection: { connect: { id: collectionRecord!.id } },
            },
          });
          console.log(`    Created SubSeries: ${finalSubSeriesName}`);
          finalSubSeries = { id: created.id };
        }
        subSeriesCache.set(finalSubSeriesName, finalSubSeries);
      }

      const modelKey = collectorNumber !== null ? collectorNumberStr : `${finalSubSeriesName}-${castingName}`;
      let model = modelCache.get(modelKey);
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: castingName,
            subSeriesId: finalSubSeries.id,
            collectionId: collectionRecord!.id,
          },
        });
        if (existingModel) {
          model = { id: existingModel.id };
          if (!existingModel.castingId) {
            await prisma.model.update({
              where: { id: existingModel.id },
              data: { castingId: toyNumber },
            });
          }
        } else {
          const createdModel = await prisma.model.create({
            data: {
              castingName,
              castingId: toyNumber,
              description: null,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: finalSubSeries.id } },
            },
          });
          model = { id: createdModel.id };
        }
        modelCache.set(modelKey, model);
      }

      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: toyNumber,
          year: targetYear,
          color: colorVariant ?? null,
        },
      });
      if (existingVariant) {
        continue;
      }

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: targetYear,
          releaseName: finalSubSeriesName,
          color: colorVariant ?? null,
          cardNumber: collectorNumberStr,
          toyNumber: toyNumber,
          isTreasureHunt,
          isSuperTreasureHunt,
          wheelType: null,
          cardVariation: null,
          owned: false,
          quantity: 0,
          condition: null,
          notes: notes.length > 0 ? notes : null,
        },
      });

      processedCount++;
    }

    console.log(`  ✅ Processed ${processedCount} variants from ${subSeriesName}`);
  }

  console.log('\n✅ Import completed successfully.');
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
