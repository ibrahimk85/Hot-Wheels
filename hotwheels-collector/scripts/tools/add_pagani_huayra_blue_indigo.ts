/**
 * Script to add missing '21 Pagani Huayra R - Spectraflame Blue Indigo variant
 * 
 * Usage:
 *   npx ts-node scripts/tools/add_pagani_huayra_blue_indigo.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();
const RLC_URL = 'https://hotwheels.fandom.com/wiki/2024_HWC/RLC_Releases';
const TARGET_YEAR = 2024;
const COLLECTION_NAME = 'Red Line Club';
const CASTING_NAME = "'21 Pagani Huayra R";
const TARGET_COLOR = 'Spectraflame Blue Indigo';

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

async function findVariantInWiki(): Promise<{
  color: string;
  saleDate: string | null;
  quantity: string | null;
  seriesName: string | null;
} | null> {
  console.log(`Fetching ${COLLECTION_NAME} ${TARGET_YEAR} data from wiki...`);
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

  const headerRow = table.find('thead tr, tbody tr').first();
  const headerCells = headerRow.find('th, td');
  
  const seriesColIdx = findColumnIndex(headerCells, ['series', 'sub-series', 'subseries']);
  const castingColIdx = findColumnIndex(headerCells, ['casting', 'casting name', 'model', 'car']);
  const colorColIdx = findColumnIndex(headerCells, ['color', 'paint', 'finish']);
  const saleDateColIdx = findColumnIndex(headerCells, ['sale date', 'date', 'release date']);
  const quantityColIdx = findColumnIndex(headerCells, ['quantity', 'qty', 'units', 'production']);

  if (castingColIdx === -1) {
    throw new Error('Could not find Casting Name column in table');
  }

  const tbodyRows = table.find('tbody tr');

  for (let i = 0; i < tbodyRows.length; i++) {
    const row = tbodyRows[i];
    const cells = $(row).find('td, th');
    
    if (cells.length < 2) continue;
    
    const castingNameCell = castingColIdx >= 0 && cells.length > castingColIdx 
      ? $(cells[castingColIdx]) 
      : null;
    
    if (!castingNameCell || castingNameCell.length === 0) continue;
    
    const castingNameLink = castingNameCell.find('a').first();
    const castingName = castingNameLink.length > 0 
      ? castingNameLink.text().trim() 
      : castingNameCell.text().trim();
    
    if (!castingName || !castingName.includes("Pagani Huayra R")) continue;

    // Check color column
    const colorCell = colorColIdx >= 0 && cells.length > colorColIdx 
      ? $(cells[colorColIdx]).text().trim()
      : '';
    
    // Check if this is the Blue Indigo variant
    if (colorCell.toLowerCase().includes('blue indigo') || colorCell.toLowerCase().includes('indigo')) {
      const seriesName = seriesColIdx >= 0 && cells.length > seriesColIdx 
        ? $(cells[seriesColIdx]).text().trim() 
        : null;
      
      const saleDate = saleDateColIdx >= 0 && cells.length > saleDateColIdx
        ? $(cells[saleDateColIdx]).text().trim()
        : null;
      
      const quantity = quantityColIdx >= 0 && cells.length > quantityColIdx
        ? $(cells[quantityColIdx]).text().trim()
        : null;

      console.log(`Found variant in wiki:`);
      console.log(`  Casting: ${castingName}`);
      console.log(`  Color: ${colorCell}`);
      console.log(`  Series: ${seriesName}`);
      console.log(`  Sale Date: ${saleDate}`);
      console.log(`  Quantity: ${quantity}`);

      return {
        color: colorCell,
        saleDate,
        quantity,
        seriesName,
      };
    }
  }

  return null;
}

async function main() {
  try {
    // Find existing model
    const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
    if (!yearRecord) {
      throw new Error(`Year ${TARGET_YEAR} not found`);
    }

    const collectionRecord = await prisma.collection.findFirst({
      where: {
        name: COLLECTION_NAME,
        yearId: yearRecord.id,
      },
    });

    if (!collectionRecord) {
      throw new Error(`Collection ${COLLECTION_NAME} for year ${TARGET_YEAR} not found`);
    }

    // Find the existing model
    const existingModel = await prisma.model.findFirst({
      where: {
        castingName: CASTING_NAME,
        collectionId: collectionRecord.id,
      },
      include: {
        subSeries: true,
        variants: {
          where: {
            year: TARGET_YEAR,
          },
        },
      },
    });

    if (!existingModel) {
      throw new Error(`Model "${CASTING_NAME}" not found in database`);
    }

    console.log(`Found existing model: ${existingModel.castingName}`);
    console.log(`  Model ID: ${existingModel.id}`);
    console.log(`  SubSeries: ${existingModel.subSeries?.name || 'None'}`);
    console.log(`  Existing variants: ${existingModel.variants.length}`);

    // Check if Blue Indigo variant already exists
    const existingBlueIndigo = existingModel.variants.find(v => 
      v.color && v.color.toLowerCase().includes('blue indigo')
    );

    if (existingBlueIndigo) {
      console.log(`\nBlue Indigo variant already exists!`);
      console.log(`  Variant ID: ${existingBlueIndigo.id}`);
      console.log(`  Color: ${existingBlueIndigo.color}`);
      return;
    }

    // Find variant details from wiki
    const wikiVariant = await findVariantInWiki();
    if (!wikiVariant) {
      throw new Error(`Could not find Blue Indigo variant in wiki`);
    }

    // Create new variant
    const newVariant = await prisma.variant.create({
      data: {
        model: { connect: { id: existingModel.id } },
        year: TARGET_YEAR,
        color: wikiVariant.color,
        releaseName: wikiVariant.seriesName || existingModel.subSeries?.name || null,
      },
    });

    console.log(`\n✅ Successfully created variant:`);
    console.log(`  Variant ID: ${newVariant.id}`);
    console.log(`  Color: ${newVariant.color}`);
    console.log(`  Year: ${newVariant.year}`);
    console.log(`  Release Name: ${newVariant.releaseName}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();







