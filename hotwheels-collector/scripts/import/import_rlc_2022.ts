/**
 * Script to import Red Line Club (RLC) 2024 collection data
 * 
 * Usage:
 *   npx ts-node scripts/import/import_rlc_2024.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();
const RLC_URL = 'https://hotwheels.fandom.com/wiki/2022_HWC/RLC_Releases';
const TARGET_YEAR = 2022;
const COLLECTION_NAME = 'Red Line Club';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchCastingDetails(castingUrl: string): Promise<{
  description: string | null;
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
}> {
  try {
    const response = await fetch(castingUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch casting page: ${castingUrl}`);
      return {
        description: null,
        debutSeries: null,
        produced: null,
        designer: null,
        castingNumber: null,
      };
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let description: string | null = null;
    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    
    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) {
      description = descriptionPara;
    }
    
    const infobox = $('.infobox, .wikitable').first();
    if (infobox.length > 0) {
      infobox.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();
          
          if (/debut|first.*appear/i.test(label)) {
            debutSeries = value || null;
          }
          if (/produced|years/i.test(label)) {
            produced = value || null;
          }
          if (/designer/i.test(label)) {
            designer = value || null;
          }
          if (/number|casting.*number/i.test(label) && !/toy|series/i.test(label)) {
            castingNumber = value || null;
          }
        }
      });
    }
    
    return {
      description,
      debutSeries,
      produced,
      designer,
      castingNumber,
    };
  } catch (error) {
    console.warn(`Error fetching casting details from ${castingUrl}:`, error);
    return {
      description: null,
      debutSeries: null,
      produced: null,
      designer: null,
      castingNumber: null,
    };
  }
}

function findColumnIndex(headers: cheerio.Cheerio<any>, searchTerms: string[]): number {
  let index = -1;
  headers.each((idx, cell) => {
    const text = cheerio.load(cell).text().trim().toLowerCase();
    if (searchTerms.some(term => text.includes(term))) {
      index = idx;
      return false;
    }
  });
  return index;
}

async function main() {
  console.log(`Fetching ${COLLECTION_NAME} ${TARGET_YEAR} data...`);
  const response = await fetch(RLC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RLC_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const table = $('table.wikitable, table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the RLC table on the page');
  }

  let yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRecord) {
    yearRecord = await prisma.year.create({ data: { year: TARGET_YEAR } });
    console.log(`Created Year record for ${TARGET_YEAR}`);
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
        code: 'RLC',
        isFuture: false,
        year: { connect: { id: yearRecord.id } },
      },
    });
    console.log(`Created Collection record for ${COLLECTION_NAME} (${TARGET_YEAR})`);
  }

  const headerRow = table.find('thead tr, tbody tr').first();
  const headerCells = headerRow.find('th, td');
  
  const seriesColIdx = findColumnIndex(headerCells, ['series', 'sub-series', 'subseries']);
  const castingColIdx = findColumnIndex(headerCells, ['casting', 'casting name', 'model', 'car']);
  const saleDateColIdx = findColumnIndex(headerCells, ['sale date', 'date', 'release date']);
  const quantityColIdx = findColumnIndex(headerCells, ['quantity', 'qty', 'units', 'production']);

  console.log(`Column indices - Series: ${seriesColIdx}, Casting: ${castingColIdx}, Sale Date: ${saleDateColIdx}, Quantity: ${quantityColIdx}`);

  if (castingColIdx === -1) {
    throw new Error('Could not find Casting Name column in table');
  }

  const tbodyRows = table.find('tbody tr');
  if (headerRow.parent().is('tbody')) {
    tbodyRows.slice(1);
  }

  console.log(`\nProcessing ${tbodyRows.length} rows for year ${TARGET_YEAR}...`);

  const subSeriesMap = new Map<string, { id: number }>();
  let modelsCreated = 0;

  for (let i = 0; i < tbodyRows.length; i++) {
    const row = tbodyRows[i];
    const cells = $(row).find('td, th');
    
    if (cells.length < 2) continue;
    
    const seriesName = seriesColIdx >= 0 && cells.length > seriesColIdx 
      ? $(cells[seriesColIdx]).text().trim() 
      : `${COLLECTION_NAME} ${TARGET_YEAR}`;
    
    const castingNameCell = castingColIdx >= 0 && cells.length > castingColIdx 
      ? $(cells[castingColIdx]) 
      : null;
    
    if (!castingNameCell || castingNameCell.length === 0) continue;
    
    const castingNameLink = castingNameCell.find('a').first();
    const castingName = castingNameLink.length > 0 
      ? castingNameLink.text().trim() 
      : castingNameCell.text().trim();
    
    if (!castingName || castingName.length === 0) continue;

    const saleDate = saleDateColIdx >= 0 && cells.length > saleDateColIdx
      ? $(cells[saleDateColIdx]).text().trim()
      : null;
    
    const quantity = quantityColIdx >= 0 && cells.length > quantityColIdx
      ? $(cells[quantityColIdx]).text().trim()
      : null;

    const castingUrl = castingNameLink.length > 0 
      ? castingNameLink.attr('href') 
      : null;
    const fullCastingUrl = castingUrl 
      ? (castingUrl.startsWith('http') ? castingUrl : `https://hotwheels.fandom.com${castingUrl}`)
      : null;

    let castingDetails = {
      description: null as string | null,
      debutSeries: null as string | null,
      produced: null as string | null,
      designer: null as string | null,
      castingNumber: null as string | null,
    };
    
    if (fullCastingUrl) {
      castingDetails = await fetchCastingDetails(fullCastingUrl);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    let subSeries = subSeriesMap.get(seriesName);
    if (!subSeries) {
      const existingSubSeries = await prisma.subSeries.findFirst({
        where: {
          name: seriesName,
          collectionId: collectionRecord.id,
        },
      });
      
      if (existingSubSeries) {
        subSeries = { id: existingSubSeries.id };
      } else {
        const created = await prisma.subSeries.create({
          data: {
            name: seriesName,
            collection: { connect: { id: collectionRecord.id } },
          },
        });
        subSeries = { id: created.id };
        console.log(`Created SubSeries: ${seriesName}`);
      }
      subSeriesMap.set(seriesName, subSeries);
    }

    let descriptionParts: string[] = [];
    if (castingDetails.description) {
      descriptionParts.push(castingDetails.description);
    }
    if (saleDate) {
      descriptionParts.push(`Sale Date: ${saleDate}`);
    }
    if (quantity) {
      descriptionParts.push(`Quantity: ${quantity}`);
    }
    const fullDescription = descriptionParts.length > 0 ? descriptionParts.join(' | ') : null;

    let model = await prisma.model.findFirst({
      where: {
        castingName: castingName,
        collectionId: collectionRecord.id,
        subSeriesId: subSeries.id,
      },
    });

    if (!model) {
      model = await prisma.model.create({
        data: {
          castingName,
          description: fullDescription,
          debutSeries: castingDetails.debutSeries,
          produced: castingDetails.produced,
          designer: castingDetails.designer,
          castingNumber: castingDetails.castingNumber,
          saleDate: saleDate || null,
          collection: { connect: { id: collectionRecord.id } },
          subSeries: { connect: { id: subSeries.id } },
        },
      });
      modelsCreated++;
      console.log(`Created Model: ${castingName} (Series: ${seriesName})`);
    } else {
      const updateData: any = {};
      if (!model.description && fullDescription) updateData.description = fullDescription;
      if (!model.debutSeries && castingDetails.debutSeries) updateData.debutSeries = castingDetails.debutSeries;
      if (!model.produced && castingDetails.produced) updateData.produced = castingDetails.produced;
      if (!model.designer && castingDetails.designer) updateData.designer = castingDetails.designer;
      if (!model.castingNumber && castingDetails.castingNumber) updateData.castingNumber = castingDetails.castingNumber;
      if (!model.saleDate && saleDate) updateData.saleDate = saleDate;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.model.update({
          where: { id: model.id },
          data: updateData,
        });
      }
    }

    // Create variant for RLC (each model needs at least one variant)
    const existingVariant = await prisma.variant.findFirst({
      where: {
        modelId: model.id,
        year: TARGET_YEAR,
      },
    });

    if (!existingVariant) {
      await prisma.variant.create({
        data: {
          model: { connect: { id: model.id } },
          year: TARGET_YEAR,
          releaseName: seriesName,
        },
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nYear ${TARGET_YEAR} complete:`);
  console.log(`  Models created: ${modelsCreated}`);
  console.log(`  SubSeries created: ${subSeriesMap.size}`);
}

main()
  .catch((err) => {
    console.error('Error during import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



