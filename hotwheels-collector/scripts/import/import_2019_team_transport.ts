/**
 * Script to import the 2019 Hot Wheels Team Transport set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2019 Team Transport page from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (each sub-series has its own table: Mix 1, Mix 2, etc.)
 *   3. Groups rows by Toy# and Series# (same Toy# and Series# = one set)
 *   4. First row in group = Transport casting
 *   5. Subsequent rows = Car castings
 *   6. Creates Model Araba name from car castings (single car = direct, multiple cars = "&" joined)
 *   7. Creates database records: Year → Collection (Team Transport) → SubSeries → Model → Variant
 *
 * Team Transport-specific:
 * - Each Series# creates one "Model Araba" (car model)
 * - Transport castings are also separate Models
 * - Model Araba name = car casting names joined with "&"
 * - Photo Carded → Model's mainImageId
 * - Photo Loose → Variant's images
 *
 * How to use:
 *   npx ts-node scripts/import/import_2019_team_transport.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const targetYear = 2019;
const URL = 'https://hotwheels.fandom.com/wiki/2019_Car_Culture:_Team_Transport';

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
      console.warn(`Failed to fetch model page: ${modelUrl}`);
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
    console.warn(`Error fetching model metadata from ${modelUrl}:`, error);
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
  
  // Try previous div with class containing "heading" or "title"
  if (!subSeriesName) {
    const prevDiv = $(table).prevAll('div[class*="heading"], div[class*="title"]').first();
    if (prevDiv.length > 0) {
      const divText = prevDiv.text().trim();
      if (divText && !/^(contents|references|see also|external links|categories)$/i.test(divText)) {
        subSeriesName = divText;
      }
    }
  }
  
  // Try previous strong or bold text
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
  rowElement: any;
}

async function main() {
  console.log(`Fetching ${targetYear} Team Transport data from ${URL}…`);
  const response = await fetch(URL);
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

  const collectionName = 'Team Transport';
  let collectionRecord = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      yearId: yearRecord.id,
    },
  });
  if (!collectionRecord) {
    collectionRecord = await prisma.collection.create({
      data: {
        name: collectionName,
        code: collectionName,
        year: {
          connect: { id: yearRecord.id },
        },
      },
    });
    console.log(`Created Collection record for ${collectionName}`);
  }

  const subSeriesCache = new Map<string, { id: number }>();
  const modelCache = new Map<string, { id: number }>();
  const modelMetadataCache = new Map<string, any>();

  let totalProcessed = 0;
  let totalCreated = 0;

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const subSeriesName = extractSubSeriesName($, table);
    
    // Debug: Log all found sub-series names
    console.log(`Table ${tableIdx + 1}: Found sub-series name: "${subSeriesName}"`);
    
    if (/^(contents|references|see also|external links|categories)$/i.test(subSeriesName)) {
      console.log(`Skipping table with name: ${subSeriesName}`);
      continue;
    }

    console.log(`\nProcessing ${subSeriesName}…`);

    const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
      const cells = $(row).find('td');
      return cells.length >= 3;
    });

    console.log(`Found ${rows.length} rows in ${subSeriesName} (filtered from ${$(table).find('tbody tr').length} total rows)`);

    // Special handling for "Supreme Exclusive" - it might have a different table structure
    const isSupremeExclusive = subSeriesName.toLowerCase().includes('supreme');
    
    // Parse all rows into RowData
    // Note: Transport rows have Toy# and Series#, car rows inherit them from the previous transport row
    const rowDataList: RowData[] = [];
    let currentToyNumber = '';
    let currentSeriesNumber = '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      // Extract cell values
      const cellValues: string[] = [];
      cells.each((idx, cell) => {
        cellValues.push($(cell).text().trim());
      });

      // Debug for Supreme Exclusive
      if (isSupremeExclusive && i < 2) {
        console.log(`  Supreme Exclusive Row ${i} cells (${cellValues.length}): ${cellValues.map((v, idx) => `[${idx}]${v.substring(0, 30)}`).join(' | ')}`);
      }

      // Check if this is a transport row (has Toy# and Series#) or car row
      const firstCell = cellValues[0] || '';
      const secondCell = cellValues[1] || '';
      
      let toyNumber = '';
      let seriesNumber = '';
      let castingNameRaw = '';
      let castingNameLink = $();
      let bodyColor = '';
      let wheelType = '';
      let notes = '';
      
      // Transport row pattern: First cell is Toy# (short alphanumeric), second is Series# (digit or N/A for Supreme Exclusive)
      // For Supreme Exclusive, Series# can be "N/A"
      const isValidSeriesNumber = /^\d+$/.test(secondCell) && parseInt(secondCell, 10) <= 100;
      const isNAForSupreme = isSupremeExclusive && secondCell.toUpperCase() === 'N/A';
      
      if (firstCell.length >= 3 && firstCell.length <= 8 && /^[A-Z0-9]+$/i.test(firstCell) && !firstCell.includes(' ') &&
          (isValidSeriesNumber || isNAForSupreme)) {
        // This is a transport row
        toyNumber = firstCell;
        // For Supreme Exclusive with N/A, use Toy# as Series# to create unique set identifier
        seriesNumber = isNAForSupreme ? firstCell : secondCell;
        currentToyNumber = toyNumber;
        currentSeriesNumber = seriesNumber;
        
        // Parse casting name (column 2 for transport row)
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
        // This is a car row - inherit Toy# and Series# from previous transport row
        toyNumber = currentToyNumber;
        seriesNumber = currentSeriesNumber;
        
        if (!toyNumber || !seriesNumber) {
          console.warn(`Car row ${i} has no parent transport row (Toy#=${toyNumber}, Series#=${seriesNumber}), skipping`);
          if (isSupremeExclusive) {
            console.warn(`  Supreme Exclusive row ${i} cells: ${cellValues.map((v, idx) => `[${idx}]${v.substring(0, 30)}`).join(' | ')}`);
          }
          continue;
        }
        
        // Car row pattern: First cell is Casting Name, second is Body Color, third is Wheel Type, etc.
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
        console.warn(`Skipping row ${i} with missing data: Toy#=${toyNumber}, Series#=${seriesNumber}, Name=${castingNameRaw}`);
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
        rowElement: row,
      });
    }

    const groupedBySet = new Map<string, RowData[]>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.seriesNumber}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    console.log(`Found ${groupedBySet.size} sets (grouped by Toy# and Series#)`);

    let subSeries = subSeriesCache.get(subSeriesName);
    if (!subSeries) {
      const existingSub = await prisma.subSeries.findFirst({
        where: {
          name: subSeriesName,
          collectionId: collectionRecord!.id,
        },
      });
      if (existingSub) {
        subSeries = { id: existingSub.id };
      } else {
        const created = await prisma.subSeries.create({
          data: {
            name: subSeriesName,
            collection: { connect: { id: collectionRecord!.id } },
          },
        });
        console.log(`Created SubSeries: ${subSeriesName}`);
        subSeries = { id: created.id };
      }
      subSeriesCache.set(subSeriesName, subSeries);
    }

    for (const [setKey, setRows] of groupedBySet.entries()) {
      if (setRows.length === 0) continue;

      const transportRow = setRows[0];
      const carRows = setRows.slice(1);

      if (carRows.length === 0) {
        console.warn(`Set ${setKey} has no car rows, skipping`);
        continue;
      }

      let modelArabaName: string;
      if (carRows.length === 1) {
        modelArabaName = carRows[0].castingName;
      } else {
        modelArabaName = carRows.map(r => r.castingName).join(' & ');
      }

      const modelArabaKey = `${modelArabaName}_${subSeriesName}_${transportRow.seriesNumber}`;
      let modelAraba = modelCache.get(modelArabaKey);
      
      if (!modelAraba) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: modelArabaName,
            subSeriesId: subSeries.id,
            collectionId: collectionRecord!.id,
          },
        });
        
        if (existingModel) {
          modelAraba = { id: existingModel.id };
        } else {
          let metadata = modelMetadataCache.get(carRows[0].castingName);
          if (!metadata && carRows[0].castingNameLink.length > 0) {
            const modelPageHref = carRows[0].castingNameLink.attr('href');
            if (modelPageHref) {
              const modelUrl = modelPageHref.startsWith('http')
                ? modelPageHref
                : `https://hotwheels.fandom.com${modelPageHref}`;
              
              console.log(`Fetching metadata for ${carRows[0].castingName}...`);
              metadata = await fetchModelMetadata(modelUrl);
              modelMetadataCache.set(carRows[0].castingName, metadata);
              await sleep(500);
            }
          }
          
          if (!metadata) {
            metadata = {
              debutSeries: null,
              produced: null,
              designer: null,
              castingNumber: null,
              description: null,
            };
          }

          // Fetch transport metadata to include in description
          let transportMetadata = modelMetadataCache.get(transportRow.castingName);
          if (!transportMetadata && transportRow.castingNameLink.length > 0) {
            const transportPageHref = transportRow.castingNameLink.attr('href');
            if (transportPageHref) {
              const transportUrl = transportPageHref.startsWith('http')
                ? transportPageHref
                : `https://hotwheels.fandom.com${transportPageHref}`;
              
              console.log(`Fetching metadata for transport ${transportRow.castingName}...`);
              transportMetadata = await fetchModelMetadata(transportUrl);
              modelMetadataCache.set(transportRow.castingName, transportMetadata);
              await sleep(500);
            }
          }
          
          if (!transportMetadata) {
            transportMetadata = {
              debutSeries: null,
              produced: null,
              designer: null,
              castingNumber: null,
              description: null,
            };
          }

          // Build description from all car castings and transport metadata
          const descriptionParts: string[] = [];
          if (metadata.description) {
            descriptionParts.push(metadata.description);
          }
          if (carRows.length > 1) {
            descriptionParts.push(`\n\nThis set includes: ${carRows.map(r => r.castingName).join(', ')}`);
          }
          // Add transport information
          descriptionParts.push(`\n\nTransport: ${transportRow.castingName}`);
          if (transportMetadata.description) {
            descriptionParts.push(`\n${transportMetadata.description}`);
          }
          if (transportRow.bodyColor) {
            descriptionParts.push(`\nTransport Color: ${transportRow.bodyColor}`);
          }
          if (transportRow.wheelType) {
            descriptionParts.push(`\nTransport Wheels: ${transportRow.wheelType}`);
          }

          const createdModel = await prisma.model.create({
            data: {
              castingName: modelArabaName,
              castingId: transportRow.toyNumber,
              description: descriptionParts.join('') || null,
              debutSeries: metadata.debutSeries,
              produced: metadata.produced,
              designer: metadata.designer,
              castingNumber: metadata.castingNumber,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          modelAraba = { id: createdModel.id };
          console.log(`Created Model Araba: ${modelArabaName} (${subSeriesName})`);
        }
        modelCache.set(modelArabaKey, modelAraba);
      }

      // Create Variant for Transport (under Model Araba)
      const existingTransportVariant = await prisma.variant.findFirst({
        where: {
          modelId: modelAraba.id,
          cardNumber: transportRow.seriesNumber,
          year: targetYear,
          releaseName: { contains: 'Transport' },
        },
      });
      
      if (!existingTransportVariant) {
        await prisma.variant.create({
          data: {
            model: { connect: { id: modelAraba.id } },
            year: targetYear,
            releaseName: `${subSeriesName} - Transport: ${transportRow.castingName}`,
            color: transportRow.bodyColor || undefined,
            cardNumber: transportRow.seriesNumber,
            wheelType: transportRow.wheelType || undefined,
            isTreasureHunt: false,
            isSuperTreasureHunt: false,
            notes: transportRow.notes || undefined,
            owned: false,
            quantity: 0,
          },
        });
        totalCreated++;
        console.log(`Created Transport Variant: ${transportRow.castingName} for ${modelArabaName}`);
      }

      // Create Variants for each car casting (under Model Araba)
      for (let i = 0; i < carRows.length; i++) {
        const carRow = carRows[i];
        
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
              releaseName: `${subSeriesName} - ${carRow.castingName}`,
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
          totalCreated++;
          console.log(`Created Car Variant: ${carRow.castingName} for ${modelArabaName}`);
        }
      }

      totalProcessed++;
    }
  }

  console.log(`\nImport completed. Processed ${totalProcessed} sets, created ${totalCreated} new variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


