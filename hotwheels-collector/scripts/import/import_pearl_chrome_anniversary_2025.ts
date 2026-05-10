/**
 * Script to import the 2025 Pearl&Chrome Anniversary Series (Purple and Gold Series)
 * into your database using Prisma.
 *
 * How to use:
 *   npx ts-node scripts/import/import_pearl_chrome_anniversary_2025.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const URL = 'https://hotwheels.fandom.com/wiki/Purple_and_Gold_Series_(2025)';
const YEAR = 2025;
const COLLECTION_NAME = 'Pearl&Chrome Anniversary Series';
const SUB_SERIES_NAME = 'Purple and Gold Series';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://hotwheels.fandom.com/'
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms before retry…`);
        await sleep(delay);
        delay *= 1.5;
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

function formatDescription(color: string, tampo: string, wheelType: string, notes: string): string {
  const parts: string[] = [];
  if (color) parts.push(`Color: ${color}`);
  if (tampo) parts.push(`Tampo: ${tampo}`);
  if (wheelType) parts.push(`Wheel Type: ${wheelType}`);
  if (notes) parts.push(`Notes: ${notes}`);
  return parts.join('\n');
}

async function main() {
  console.log(`Fetching ${SUB_SERIES_NAME} data for ${YEAR}…`);
  
  let html: string;
  try {
    html = await fetchWithRetry(URL);
  } catch (error) {
    console.error(`Failed to fetch ${URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(YEAR)) || text.includes('Mix 1') || text.includes('Mix 2');
  }).first();

  let tablesToProcess;
  if (yearHeading.length > 0) {
    const mixHeadings = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return /Mix\s+[12]/i.test(text);
    });

    if (mixHeadings.length > 0) {
      tablesToProcess = [];
      mixHeadings.each((_, heading) => {
        const mixText = $(heading).text().trim();
        const mixMatch = mixText.match(/Mix\s+([12])/i);
        const mixNumber = mixMatch ? mixMatch[1] : null;
        
        const nextHeading = $(heading).nextAll('h2, h3, h4').first();
        let table;
        if (nextHeading.length > 0) {
          table = $(heading).nextUntil(nextHeading).filter('table.wikitable').first();
        } else {
          table = $(heading).nextAll('table.wikitable').first();
        }
        
        if (table.length > 0) {
          tablesToProcess.push({ table, mixNumber, subSeriesName: `${SUB_SERIES_NAME} - Mix ${mixNumber}` });
        }
      });
    } else {
      const table = yearHeading.nextUntil('h2, h3, h4').filter('table.wikitable').first();
      if (table.length === 0) {
        table = yearHeading.next('table.wikitable').first();
      }
      if (table.length > 0) {
        tablesToProcess = [{ table, mixNumber: null, subSeriesName: SUB_SERIES_NAME }];
      }
    }
  } else {
    const table = $('table.wikitable').first();
    if (table.length > 0) {
      tablesToProcess = [{ table, mixNumber: null, subSeriesName: SUB_SERIES_NAME }];
    }
  }

  if (!tablesToProcess || tablesToProcess.length === 0) {
    throw new Error('Could not find any tables on the page');
  }

  let yearRecord = await prisma.year.findFirst({ where: { year: YEAR } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: YEAR } });
    console.log(`Created Year record for ${YEAR}`);
  }

  let collectionRecord = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: COLLECTION_NAME,
        code: COLLECTION_NAME,
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for ${COLLECTION_NAME}`);
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const { table, mixNumber, subSeriesName } of tablesToProcess) {
    console.log(`\nProcessing ${subSeriesName}...`);

    let subSeriesRecord = await prisma.subSeries.findFirst({
      where: {
        name: subSeriesName,
        collectionId: collectionRecord.id,
      },
    });
    if (!subSeriesRecord) {
      subSeriesRecord = await prisma.subSeries.create({
        data: {
          name: subSeriesName,
          collection: { connect: { id: collectionRecord.id } },
        },
      });
      console.log(`Created SubSeries record for ${subSeriesName}`);
    }

    const rows = $(table).find('tbody tr');
    console.log(`Found ${rows.length} rows. Processing…`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      const colNumber = cells.length > 0 ? $(cells[0]).text().trim() : '';
      const cardNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const castingName = cells.length > 2 ? $(cells[2]).text().trim() : '';
      const color = cells.length > 3 ? $(cells[3]).text().trim() : '';
      const tampo = cells.length > 4 ? $(cells[4]).text().trim() : '';
      const wheelType = cells.length > 5 ? $(cells[5]).text().trim() : '';
      const notes = cells.length > 6 ? $(cells[6]).text().trim() : '';

      if (!cardNumber || !castingName) {
        totalSkipped++;
        continue;
      }

      const cleanCastingName = castingName.replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
      const description = formatDescription(color, tampo, wheelType, notes);

      let model = await prisma.model.findFirst({
        where: {
          castingName: cleanCastingName,
          subSeriesId: subSeriesRecord.id,
        },
      });

      if (!model) {
        model = await prisma.model.create({
          data: {
            castingName: cleanCastingName,
            description: description,
            collection: { connect: { id: collectionRecord.id } },
            subSeries: { connect: { id: subSeriesRecord.id } },
          },
        });
        console.log(`Created Model: ${cleanCastingName}`);
      } else if (description) {
        await prisma.model.update({
          where: { id: model.id },
          data: { description: description },
        });
      }

      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          cardNumber: cardNumber,
          year: YEAR,
        },
      });

      if (existingVariant) {
        totalSkipped++;
        continue;
      }

      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: YEAR,
          cardNumber: cardNumber,
          color: color || undefined,
          wheelType: wheelType || undefined,
          notes: notes || undefined,
        },
      });

      totalCreated++;
      console.log(`Created Variant: ${cleanCastingName} (${cardNumber})`);
    }
  }

  console.log(`\n=== Import completed ===`);
  console.log(`  - Variants created: ${totalCreated}`);
  console.log(`  - Variants skipped: ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
