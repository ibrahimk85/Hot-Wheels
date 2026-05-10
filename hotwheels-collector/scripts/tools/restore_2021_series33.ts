/**
 * Restore 2021 Team Transport Series#33
 * 
 * Usage:
 *   npx ts-node scripts/tools/restore_2021_series33.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2021;
const URL = 'https://hotwheels.fandom.com/wiki/2021_Car_Culture:_Team_Transport';
const targetSeriesNumber = '33';

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
    const response = await fetch(modelUrl);
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
          if (/number|casting.*number/i.test(label)) {
            castingNumber = value || null;
          }
        }
      });
    }
    
    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) {
      description = descriptionPara;
    }
    
    return {
      debutSeries,
      produced,
      designer,
      castingNumber,
      description,
    };
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
  castingNameLink: cheerio.Cheerio<any>;
  bodyColor: string;
  wheelType: string;
  notes: string;
  isTransport: boolean;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`2021 Team Transport Series#33 Geri Yükleme`);
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
  });

  if (!collection) {
    throw new Error(`Collection 'Team Transport' not found for year ${targetYear}`);
  }

  // Find Series#33 in wiki
  let foundSet: {
    subSeriesName: string;
    transportRow: RowData;
    carRows: RowData[];
  } | null = null;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      continue;
    }

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    const isSupremeExclusive = subSeriesName.toLowerCase().includes('supreme') || subSeriesName.toLowerCase().includes('walmart') || subSeriesName.toLowerCase().includes('fast') || subSeriesName.toLowerCase().includes('furious');
    
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
      let castingNameLink = $();
      let bodyColor = '';
      let wheelType = '';
      let notes = '';
      let isTransport = false;
      
      const seriesNumberClean = secondCell.replace(/^#/, '');
      const isValidSeriesNumber = /^\d+$/.test(seriesNumberClean) && parseInt(seriesNumberClean, 10) <= 100;
      const isNAForSupreme = isSupremeExclusive && secondCell.toUpperCase() === 'N/A';
      
      if (firstCell.length >= 3 && firstCell.length <= 8 && /^[A-Z0-9]+$/i.test(firstCell) && !firstCell.includes(' ') &&
          (isValidSeriesNumber || isNAForSupreme)) {
        isTransport = true;
        toyNumber = firstCell;
        seriesNumber = isNAForSupreme ? firstCell : seriesNumberClean;
        currentToyNumber = toyNumber;
        currentSeriesNumber = seriesNumber;
        
        if (cells.length > 2) {
          const cell = $(cells[2]);
          const link = cell.find('a').first();
          if (link.length > 0) {
            castingNameRaw = link.text().trim();
            castingNameLink = link;
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
            castingNameLink = link;
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
        castingNameLink,
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

    // Find Series#33
    for (const [setKey, setRows] of groupedBySet.entries()) {
      const transportRow = setRows.find(r => r.isTransport);
      const carRows = setRows.filter(r => !r.isTransport);

      if (transportRow && transportRow.seriesNumber === targetSeriesNumber) {
        foundSet = {
          subSeriesName,
          transportRow,
          carRows,
        };
        break;
      }
    }

    if (foundSet) break;
  }

  if (!foundSet) {
    console.log(`❌ Series# ${targetSeriesNumber} bulunamadı!`);
    return;
  }

  console.log(`\n✅ Series# ${targetSeriesNumber} bulundu:`);
  console.log(`   SubSeries: ${foundSet.subSeriesName}`);
  console.log(`   Toy#: ${foundSet.transportRow.toyNumber}`);
  console.log(`   Transport: ${foundSet.transportRow.castingName}`);
  console.log(`   Car(s): ${foundSet.carRows.map(r => r.castingName).join(' & ')}`);

  // Get or create SubSeries
  const subSeries = await prisma.subSeries.findFirst({
    where: {
      name: foundSet.subSeriesName,
      collectionId: collection.id,
    },
  });

  if (!subSeries) {
    console.log(`❌ SubSeries '${foundSet.subSeriesName}' bulunamadı!`);
    return;
  }

  // Create Model Araba name
  let modelArabaName: string;
  if (foundSet.carRows.length === 1) {
    modelArabaName = foundSet.carRows[0].castingName;
  } else {
    modelArabaName = foundSet.carRows.map(r => r.castingName).join(' & ');
  }

  // Get or create Model Araba
  let modelAraba = await prisma.model.findFirst({
    where: {
      castingName: modelArabaName,
      subSeriesId: subSeries.id,
      collectionId: collection.id,
    },
  });

  if (!modelAraba) {
    console.log(`⚠️  Model '${modelArabaName}' bulunamadı, oluşturuluyor...`);
    
    let metadata = await fetchModelMetadata(
      foundSet.carRows[0].castingNameLink.length > 0
        ? `https://hotwheels.fandom.com${foundSet.carRows[0].castingNameLink.attr('href')}`
        : ''
    );
    await sleep(500);

    let transportMetadata = await fetchModelMetadata(
      foundSet.transportRow.castingNameLink.length > 0
        ? `https://hotwheels.fandom.com${foundSet.transportRow.castingNameLink.attr('href')}`
        : ''
    );
    await sleep(500);

    const descriptionParts: string[] = [];
    if (metadata.description) {
      descriptionParts.push(metadata.description);
    }
    if (foundSet.carRows.length > 1) {
      descriptionParts.push(`\n\nThis set includes: ${foundSet.carRows.map(r => r.castingName).join(', ')}`);
    }
    descriptionParts.push(`\n\nTransport: ${foundSet.transportRow.castingName}`);
    if (transportMetadata.description) {
      descriptionParts.push(`\n${transportMetadata.description}`);
    }

    modelAraba = await prisma.model.create({
      data: {
        castingName: modelArabaName,
        castingId: foundSet.transportRow.toyNumber,
        description: descriptionParts.join('') || null,
        debutSeries: metadata.debutSeries,
        produced: metadata.produced,
        designer: metadata.designer,
        castingNumber: metadata.castingNumber,
        collection: { connect: { id: collection.id } },
        subSeries: { connect: { id: subSeries.id } },
      },
    });
    console.log(`✅ Model oluşturuldu: ${modelArabaName}`);
  }

  // Create Transport Variant
  const existingTransportVariant = await prisma.variant.findFirst({
    where: {
      modelId: modelAraba.id,
      cardNumber: targetSeriesNumber,
      year: targetYear,
      releaseName: { contains: 'Transport' },
    },
  });

  if (!existingTransportVariant) {
    await prisma.variant.create({
      data: {
        model: { connect: { id: modelAraba.id } },
        year: targetYear,
        releaseName: `${foundSet.subSeriesName} - Transport: ${foundSet.transportRow.castingName}`,
        color: foundSet.transportRow.bodyColor || undefined,
        cardNumber: targetSeriesNumber,
        wheelType: foundSet.transportRow.wheelType || undefined,
        isTreasureHunt: false,
        isSuperTreasureHunt: false,
        notes: foundSet.transportRow.notes || undefined,
        owned: false,
        quantity: 0,
      },
    });
    console.log(`✅ Transport Variant oluşturuldu: ${foundSet.transportRow.castingName}`);
  } else {
    console.log(`ℹ️  Transport Variant zaten mevcut`);
  }

  // Create Car Variants
  for (let i = 0; i < foundSet.carRows.length; i++) {
    const carRow = foundSet.carRows[i];
    
    const existingCarVariant = await prisma.variant.findFirst({
      where: {
        modelId: modelAraba.id,
        cardNumber: targetSeriesNumber,
        year: targetYear,
        releaseName: { contains: carRow.castingName },
      },
    });

    if (!existingCarVariant) {
      await prisma.variant.create({
        data: {
          model: { connect: { id: modelAraba.id } },
          year: targetYear,
          releaseName: `${foundSet.subSeriesName} - ${carRow.castingName}`,
          color: carRow.bodyColor || undefined,
          cardNumber: targetSeriesNumber,
          wheelType: carRow.wheelType || undefined,
          isTreasureHunt: false,
          isSuperTreasureHunt: false,
          notes: carRow.notes || undefined,
          owned: false,
          quantity: 0,
        },
      });
      console.log(`✅ Car Variant ${i + 1}/${foundSet.carRows.length} oluşturuldu: ${carRow.castingName}`);
    } else {
      console.log(`ℹ️  Car Variant ${i + 1}/${foundSet.carRows.length} zaten mevcut: ${carRow.castingName}`);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`Tamamlandı!`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
