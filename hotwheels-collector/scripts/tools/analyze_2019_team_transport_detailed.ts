/**
 * Detailed analysis of 2019 Team Transport - lists all models from wiki and database
 * 
 * Usage:
 *   npx ts-node scripts/tools/analyze_2019_team_transport_detailed.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2019;
const URL = 'https://hotwheels.fandom.com/wiki/2019_Car_Culture:_Team_Transport';

const prisma = new PrismaClient();

function extractSubSeriesName($: cheerio.CheerioAPI, table: any): string {
  let subSeriesName = '';
  
  const prevHeading = $(table).prevAll('h2, h3, h4').first();
  if (prevHeading.length > 0) {
    const headingText = prevHeading.text().trim();
    if (!/^(contents|references|see also|external links|categories)$/i.test(headingText)) {
      subSeriesName = headingText;
    }
  }
  
  if (!subSeriesName) {
    const caption = $(table).find('caption').text().trim();
    if (caption && !/^(contents|references|see also|external links|categories)$/i.test(caption)) {
      subSeriesName = caption;
    }
  }
  
  if (!subSeriesName) {
    const prevHeadline = $(table).prevAll('span.mw-headline').first();
    if (prevHeadline.length > 0) {
      const headlineText = prevHeadline.text().trim();
      if (!/^(contents|references|see also|external links|categories)$/i.test(headlineText)) {
        subSeriesName = headlineText;
      }
    }
  }
  
  if (!subSeriesName) {
    const prevDiv = $(table).prevAll('div[class*="heading"], div[class*="title"]').first();
    if (prevDiv.length > 0) {
      const divText = prevDiv.text().trim();
      if (divText && !/^(contents|references|see also|external links|categories)$/i.test(divText)) {
        subSeriesName = divText;
      }
    }
  }
  
  if (!subSeriesName) {
    const prevStrong = $(table).prevAll('strong, b').first();
    if (prevStrong.length > 0) {
      const strongText = prevStrong.text().trim();
      if (strongText && strongText.length < 100 && !/^(contents|references|see also|external links|categories)$/i.test(strongText)) {
        subSeriesName = strongText;
      }
    }
  }
  
  return subSeriesName || 'Unknown Series';
}

interface WikiSet {
  toyNumber: string;
  seriesNumber: string;
  subSeriesName: string;
  transportCasting: string;
  carCastings: string[];
  modelArabaName: string;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`2019 Team Transport Detaylı Analiz`);
  console.log(`========================================\n`);
  
  console.log(`Fetching ${targetYear} Team Transport data from ${URL}…`);
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s) on wiki page.\n`);

  // Get collection from database
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Team Transport',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        include: {
          models: {
            include: {
              variants: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    console.log(`⚠️  Collection 'Team Transport' not found for year ${targetYear}`);
    return;
  }

  console.log(`\n========================================`);
  console.log(`WIKI SAYFASINDAKİ MODELLER`);
  console.log(`========================================\n`);

  // Parse wiki page to extract all sets
  const wikiSets: WikiSet[] = [];
  
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    let subSeriesName = extractSubSeriesName($, table);
    
    // Clean up sub-series name: remove trailing [] if present
    const cleanedSubSeriesName = subSeriesName.replace(/\[\]$/, '');
    
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      continue;
    }

    console.log(`\n${subSeriesName} (cleaned: "${cleanedSubSeriesName}")`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    const isSupremeExclusive = subSeriesName.toLowerCase().includes('supreme');
    
    const rowDataList: Array<{
      toyNumber: string;
      seriesNumber: string;
      castingName: string;
      isTransport: boolean;
    }> = [];
    
    let currentToyNumber = '';
    let currentSeriesNumber = '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      const cellValues: string[] = [];
      cells.each((idx, cell) => {
        cellValues.push($(cell).text().trim());
      });

      const firstCell = cellValues[0] || '';
      const secondCell = cellValues[1] || '';
      
      let toyNumber = '';
      let seriesNumber = '';
      let castingNameRaw = '';
      let isTransport = false;
      
      const isValidSeriesNumber = /^\d+$/.test(secondCell) && parseInt(secondCell, 10) <= 100;
      const isNAForSupreme = isSupremeExclusive && secondCell.toUpperCase() === 'N/A';
      
      if (firstCell.length >= 3 && firstCell.length <= 8 && /^[A-Z0-9]+$/i.test(firstCell) && !firstCell.includes(' ') &&
          (isValidSeriesNumber || isNAForSupreme)) {
        // Transport row
        isTransport = true;
        toyNumber = firstCell;
        seriesNumber = isNAForSupreme ? firstCell : secondCell;
        currentToyNumber = toyNumber;
        currentSeriesNumber = seriesNumber;
        
        if (cells.length > 2) {
          const cell = $(cells[2]);
          const link = cell.find('a').first();
          if (link.length > 0) {
            castingNameRaw = link.text().trim();
          } else {
            castingNameRaw = cell.text().trim();
          }
        }
      } else {
        // Car row
        isTransport = false;
        toyNumber = currentToyNumber;
        seriesNumber = currentSeriesNumber;
        
        if (!toyNumber || !seriesNumber) {
          continue;
        }
        
        if (cells.length > 0) {
          const cell = $(cells[0]);
          const link = cell.find('a').first();
          if (link.length > 0) {
            castingNameRaw = link.text().trim();
          } else {
            castingNameRaw = cell.text().trim();
          }
        }
      }

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        continue;
      }

      rowDataList.push({
        toyNumber,
        seriesNumber,
        castingName: castingNameRaw,
        isTransport,
      });
    }

    // Group by set
    const groupedBySet = new Map<string, typeof rowDataList>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.seriesNumber}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    // Create WikiSet for each group
    for (const [setKey, setRows] of groupedBySet.entries()) {
      const transportRow = setRows.find(r => r.isTransport);
      const carRows = setRows.filter(r => !r.isTransport);

      if (!transportRow || carRows.length === 0) {
        continue;
      }

      let modelArabaName: string;
      if (carRows.length === 1) {
        modelArabaName = carRows[0].castingName;
      } else {
        modelArabaName = carRows.map(r => r.castingName).join(' & ');
      }

      wikiSets.push({
        toyNumber: transportRow.toyNumber,
        seriesNumber: transportRow.seriesNumber,
        subSeriesName: cleanedSubSeriesName,
        transportCasting: transportRow.castingName,
        carCastings: carRows.map(r => r.castingName),
        modelArabaName,
      });

      console.log(`  ${modelArabaName} (Toy#: ${transportRow.toyNumber}, Series#: ${transportRow.seriesNumber})`);
      console.log(`    Transport: ${transportRow.castingName}`);
      console.log(`    Car(s): ${carRows.map(r => r.castingName).join(' & ')}`);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`VERİTABANINDAKİ MODELLER`);
  console.log(`========================================\n`);

  for (const subSeries of collection.subSeries) {
    console.log(`\n${subSeries.name} (${subSeries.models.length} model)`);
    for (const model of subSeries.models) {
      console.log(`  ${model.castingName} (ID: ${model.id}, Variants: ${model.variants.length})`);
      for (const variant of model.variants) {
        console.log(`    - ${variant.releaseName || 'N/A'} (Card#: ${variant.cardNumber}, Year: ${variant.year})`);
      }
    }
  }

  console.log(`\n\n========================================`);
  console.log(`KARŞILAŞTIRMA`);
  console.log(`========================================\n`);

  const missingSets: WikiSet[] = [];
  const existingSets: WikiSet[] = [];

  for (const wikiSet of wikiSets) {
    // Try to find subSeries - check both with and without []
    const subSeries = collection.subSeries.find(ss => 
      ss.name === wikiSet.subSeriesName || 
      ss.name === `${wikiSet.subSeriesName}[]` ||
      ss.name.replace(/\[\]$/, '') === wikiSet.subSeriesName
    );
    
    if (!subSeries) {
      console.log(`⚠️  SubSeries '${wikiSet.subSeriesName}' not found in database`);
      console.log(`   Available SubSeries: ${collection.subSeries.map(ss => `"${ss.name}"`).join(', ')}`);
      missingSets.push(wikiSet);
      continue;
    }

    const model = subSeries.models.find(m => m.castingName === wikiSet.modelArabaName);
    
    if (!model) {
      console.log(`❌ MISSING: ${wikiSet.modelArabaName} (${wikiSet.subSeriesName})`);
      console.log(`   Toy#: ${wikiSet.toyNumber}, Series#: ${wikiSet.seriesNumber}`);
      missingSets.push(wikiSet);
    } else {
      existingSets.push(wikiSet);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`ÖZET`);
  console.log(`========================================\n`);
  console.log(`Wiki'de Toplam Set: ${wikiSets.length}`);
  console.log(`Veritabanında Mevcut: ${existingSets.length}`);
  console.log(`Eksik: ${missingSets.length}\n`);

  if (missingSets.length > 0) {
    console.log(`\nEKSİK MODELLER:\n`);
    for (const missing of missingSets) {
      console.log(`- ${missing.modelArabaName}`);
      console.log(`  SubSeries: ${missing.subSeriesName}`);
      console.log(`  Toy#: ${missing.toyNumber}, Series#: ${missing.seriesNumber}`);
      console.log(`  Transport: ${missing.transportCasting}`);
      console.log(`  Car(s): ${missing.carCastings.join(' & ')}`);
      console.log(``);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
