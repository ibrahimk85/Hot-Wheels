/**
 * Add missing 2020 Team Transport Car variants
 * 
 * Missing Car variants:
 * - Mix 1: Series# 17
 * - Mix 2: Series# 19, 20, 21, 22
 * - Mix 3: Series# 23, 25
 * 
 * Usage:
 *   npx ts-node scripts/tools/add_missing_2020_team_transport_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2020;
const URL = 'https://hotwheels.fandom.com/wiki/2020_Car_Culture:_Team_Transport';

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

interface RowData {
  toyNumber: string;
  seriesNumber: string;
  castingName: string;
  bodyColor: string;
  wheelType: string;
  notes: string;
  isTransport: boolean;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`2020 Team Transport Eksik Car Variant Ekleme`);
  console.log(`========================================\n`);
  
  console.log(`Fetching ${targetYear} Team Transport data from ${URL}…`);
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} table(s).\n`);

  // Get collection
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Team Transport',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        include: {
          models: true,
        },
      },
    },
  });

  if (!collection) {
    throw new Error(`Collection 'Team Transport' not found for year ${targetYear}`);
  }

  const targetSeriesNumbers = ['17', '19', '20', '21', '22', '23', '25'];
  let totalAdded = 0;

  // Process each table
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    let subSeriesName = extractSubSeriesName($, table);
    const cleanedSubSeriesName = subSeriesName.replace(/\[\]$/, '');
    
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      continue;
    }

    const subSeries = collection.subSeries.find(ss => 
      ss.name === subSeriesName || 
      ss.name === cleanedSubSeriesName ||
      ss.name.replace(/\[\]$/, '') === cleanedSubSeriesName
    );

    if (!subSeries) {
      console.log(`⚠️  SubSeries '${subSeriesName}' not found, skipping`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}...`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    const isSupremeExclusive = subSeriesName.toLowerCase().includes('supreme');
    
    const rowDataList: RowData[] = [];
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
      let bodyColor = '';
      let wheelType = '';
      let notes = '';
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
        if (cells.length > 3) {
          bodyColor = $(cells[3]).text().trim();
        }
        if (cells.length > 4) {
          wheelType = $(cells[4]).text().trim();
        }
        if (cells.length > 5) {
          notes = $(cells[5]).text().trim();
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
        if (cells.length > 1) {
          bodyColor = $(cells[1]).text().trim();
        }
        if (cells.length > 2) {
          wheelType = $(cells[2]).text().trim();
        }
        if (cells.length > 3) {
          notes = $(cells[3]).text().trim();
        }
      }

      if (!toyNumber || !seriesNumber || !castingNameRaw) {
        continue;
      }

      rowDataList.push({
        toyNumber,
        seriesNumber,
        castingName: castingNameRaw,
        bodyColor,
        wheelType,
        notes,
        isTransport,
      });
    }

    // Group by set
    const groupedBySet = new Map<string, RowData[]>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.seriesNumber}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    // Process each set
    for (const [setKey, setRows] of groupedBySet.entries()) {
      const transportRow = setRows.find(r => r.isTransport);
      const carRows = setRows.filter(r => !r.isTransport);

      if (!transportRow || carRows.length === 0) {
        continue;
      }

      // Check if this is a target set
      const isTargetSet = targetSeriesNumbers.includes(transportRow.seriesNumber);

      if (!isTargetSet) {
        continue;
      }

      console.log(`\n  Processing set: Toy# ${transportRow.toyNumber}, Series# ${transportRow.seriesNumber}`);

      // Find Model Araba
      let modelArabaName: string;
      if (carRows.length === 1) {
        modelArabaName = carRows[0].castingName;
      } else {
        modelArabaName = carRows.map(r => r.castingName).join(' & ');
      }

      let modelAraba = await prisma.model.findFirst({
        where: {
          castingName: modelArabaName,
          subSeriesId: subSeries.id,
          collectionId: collection.id,
        },
      });

      if (!modelAraba) {
        console.log(`    ⚠️  Model '${modelArabaName}' not found, creating...`);
        modelAraba = await prisma.model.create({
          data: {
            castingName: modelArabaName,
            castingId: transportRow.toyNumber,
            collection: { connect: { id: collection.id } },
            subSeries: { connect: { id: subSeries.id } },
          },
        });
        console.log(`    ✅ Created Model: ${modelArabaName}`);
      }

      // Check and add Car variants
      for (const carRow of carRows) {
        const existingCarVariant = await prisma.variant.findFirst({
          where: {
            modelId: modelAraba.id,
            cardNumber: transportRow.seriesNumber,
            year: targetYear,
            releaseName: { contains: carRow.castingName },
          },
        });

        if (!existingCarVariant) {
          await prisma.variant.create({
            data: {
              model: { connect: { id: modelAraba.id } },
              year: targetYear,
              releaseName: `${cleanedSubSeriesName} - ${carRow.castingName}`,
              color: carRow.bodyColor || undefined,
              cardNumber: transportRow.seriesNumber,
              wheelType: carRow.wheelType || undefined,
              isTreasureHunt: false,
              isSuperTreasureHunt: false,
              notes: carRow.notes || undefined,
              owned: false,
              quantity: 0,
            },
          });
          totalAdded++;
          console.log(`    ✅ Added Car Variant: ${carRow.castingName} (Series#: ${transportRow.seriesNumber})`);
        } else {
          console.log(`    ℹ️  Car Variant already exists: ${carRow.castingName}`);
        }
      }
    }
  }

  console.log(`\n\n========================================`);
  console.log(`Tamamlandı!`);
  console.log(`========================================\n`);
  console.log(`Toplam ${totalAdded} yeni Car variant eklendi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
