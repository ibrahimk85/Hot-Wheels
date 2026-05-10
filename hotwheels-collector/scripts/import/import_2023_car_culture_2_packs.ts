/**
 * Script to import the 2023 Hot Wheels Car Culture 2-Packs set into your database using Prisma.
 *
 * This script:
 *   1. Fetches the 2023 Car Culture 2-Packs page from Hot Wheels Fandom wiki
 *   2. Parses multiple tables (each sub-series has its own table: Mix 1, Mix 2, etc.)
 *   3. Groups rows by Toy# and Theme (same Toy# and Theme = one 2-Pack set)
 *   4. Each set contains 2 car castings (2 rows per set)
 *   5. Creates Model name from car castings: "Casting Name 1 & Casting Name 2"
 *   6. Creates database records: Year → Collection (Car Culture 2-Packs) → SubSeries → Model → Variant
 *
 * Car Culture 2-Packs-specific:
 * - Each set (Toy# + Theme) creates one Model with 2 Variants
 * - Model name = car casting names joined with "&"
 * - Photo Carded → Model's mainImageId
 * - Photo Loose → Variant's images
 *
 * Table columns (0-based index):
 * 0: Toy#
 * 1: Theme
 * 2: Casting Name
 * 3: Body Color
 * 4: Wheel Type
 * 5: Notes
 * 6: Photo Loose
 * 7: Photo Carded
 *
 * How to use:
 *   npx ts-node scripts/import/import_2023_car_culture_2_packs.ts
 */
 
 import 'dotenv/config';
 import { PrismaClient } from '@prisma/client';
 import * as cheerio from 'cheerio';
 
 const targetYear = 2023;
const URL = 'https://hotwheels.fandom.com/wiki/Car_Culture_2-Packs';

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
    const response = await fetch(modelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
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

function extractYearFromHeading($: cheerio.CheerioAPI, table: any): number | null {
  // Look for headings before this table that contain year information
  const prevHeadings = $(table).prevAll('h2, h3, h4, span.mw-headline');
  for (let i = 0; i < prevHeadings.length && i < 10; i++) {
    const heading = prevHeadings.eq(i);
    const headingText = heading.text().trim();
    // Look for 4-digit year pattern (2021, 2022, etc.)
    const yearMatch = headingText.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10);
    }
  }
  return null;
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
  
  // Clean up sub-series name: remove trailing [] if present
  const cleanedName = (subSeriesName || 'Unknown Series').replace(/\[\]$/, '');
  return cleanedName;
}

interface RowData {
  toyNumber: string;
  theme: string;
  castingName: string;
  castingNameLink: cheerio.Cheerio<any>;
  bodyColor: string;
  wheelType: string;
  notes: string;
  rowElement: any;
}

async function main() {
  console.log(`Fetching ${targetYear} Car Culture 2-Packs data from ${URL}…`);
  const response = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
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

  const collectionName = 'Car Culture 2-Packs';
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
    
    // Filter tables by year - only process tables that belong to targetYear
    const tableYear = extractYearFromHeading($, table);
    if (tableYear !== null) {
      // If we found a year in the heading, it must match targetYear
      if (tableYear !== targetYear) {
        console.log(`Table ${tableIdx + 1}: Skipping table from year ${tableYear} (target: ${targetYear})`);
        continue;
      }
    } else {
      // If no year found in heading, only process if it's the first year (2021)
      // For other years, we require an explicit year heading
      console.log(`Table ${tableIdx + 1}: No year found in heading, skipping (target: ${targetYear}, only 2021 processes tables without year heading)`);
      continue;
    }
    
    const subSeriesName = extractSubSeriesName($, table);
    
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

    // Parse all rows into RowData
    // Columns for first row: 0=Toy#, 1=Theme, 2=Casting Name, 3=Body Color, 4=Wheel Type, 5=Notes, 6=Photo Loose, 7=Photo Carded
    // Columns for second row: 0=Casting Name, 1=Body Color, 2=Wheel Type, 3=Notes (Toy# and Theme are merged from first row)
    const rowDataList: RowData[] = [];
    let lastToyNumber = '';
    let lastTheme = '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      
      if (cells.length === 0) continue;

      let toyNumber: string;
      let theme: string;
      let castingNameCell: cheerio.Cheerio<any>;
      let bodyColor: string;
      let wheelType: string;
      let notes: string;

      // Check if this is a first row (has Toy# and Theme) or second row (starts with Casting Name)
      // First row typically has 8 cells, second row has 4-5 cells
      // Also check if first cell looks like a Toy# (e.g., "HBL97") vs a Casting Name
      const firstCell = $(cells[0]).text().trim();
      const isFirstRow = cells.length >= 7 || /^[A-Z]{2,3}\d{2,3}$/.test(firstCell); // Toy# pattern like "HBL97"

      if (isFirstRow) {
        // First row: has Toy#, Theme, and all columns
        toyNumber = firstCell;
        theme = $(cells[1]).text().trim();
        castingNameCell = $(cells[2]);
        bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
        wheelType = cells.length > 4 ? $(cells[4]).text().trim() : '';
        notes = cells.length > 5 ? $(cells[5]).text().trim() : '';
        
        // Save for next row
        lastToyNumber = toyNumber;
        lastTheme = theme;
      } else {
        // Second row: no Toy# or Theme, starts with Casting Name
        toyNumber = lastToyNumber;
        theme = lastTheme;
        castingNameCell = $(cells[0]);
        bodyColor = cells.length > 1 ? $(cells[1]).text().trim() : '';
        wheelType = cells.length > 2 ? $(cells[2]).text().trim() : '';
        notes = cells.length > 3 ? $(cells[3]).text().trim() : '';
      }

      const castingNameLink = castingNameCell.find('a').first();
      const castingName = castingNameLink.length > 0 ? castingNameLink.text().trim() : castingNameCell.text().trim();

      if (!toyNumber || !theme || !castingName) {
        console.warn(`Skipping row ${i} with missing data: Toy#=${toyNumber}, Theme=${theme}, Casting=${castingName}`);
        continue;
      }

      rowDataList.push({
        toyNumber,
        theme,
        castingName,
        castingNameLink: castingNameLink.length > 0 ? castingNameLink : castingNameCell,
        bodyColor,
        wheelType,
        notes,
        rowElement: row,
      });
    }

    // Group rows by Toy# and Theme (2 rows per set)
    const groupedBySet = new Map<string, RowData[]>();
    for (const rowData of rowDataList) {
      const key = `${rowData.toyNumber}_${rowData.theme}`;
      if (!groupedBySet.has(key)) {
        groupedBySet.set(key, []);
      }
      groupedBySet.get(key)!.push(rowData);
    }

    console.log(`Found ${groupedBySet.size} sets (grouped by Toy# and Theme)`);

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

      // Each set should have exactly 2 cars
      if (setRows.length !== 2) {
        console.warn(`Set ${setKey} has ${setRows.length} rows (expected 2), skipping`);
        continue;
      }

      const car1 = setRows[0];
      const car2 = setRows[1];

      // Create Model name: "Casting Name 1 & Casting Name 2"
      const modelName = `${car1.castingName} & ${car2.castingName}`;

      const modelKey = `${modelName}_${subSeriesName}_${car1.toyNumber}`;
      let model = modelCache.get(modelKey);
      
      if (!model) {
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: modelName,
            subSeriesId: subSeries.id,
            collectionId: collectionRecord!.id,
          },
        });
        
        if (existingModel) {
          model = { id: existingModel.id };
        } else {
          // Fetch metadata for first car
          let metadata1 = modelMetadataCache.get(car1.castingName);
          if (!metadata1 && car1.castingNameLink.length > 0) {
            const modelPageHref = car1.castingNameLink.attr('href');
            if (modelPageHref) {
              const modelUrl = modelPageHref.startsWith('http')
                ? modelPageHref
                : `https://hotwheels.fandom.com${modelPageHref}`;
              
              console.log(`Fetching metadata for ${car1.castingName}...`);
              metadata1 = await fetchModelMetadata(modelUrl);
              modelMetadataCache.set(car1.castingName, metadata1);
              await sleep(500);
            }
          }
          
          if (!metadata1) {
            metadata1 = {
              debutSeries: null,
              produced: null,
              designer: null,
              castingNumber: null,
              description: null,
            };
          }

          // Fetch metadata for second car
          let metadata2 = modelMetadataCache.get(car2.castingName);
          if (!metadata2 && car2.castingNameLink.length > 0) {
            const modelPageHref = car2.castingNameLink.attr('href');
            if (modelPageHref) {
              const modelUrl = modelPageHref.startsWith('http')
                ? modelPageHref
                : `https://hotwheels.fandom.com${modelPageHref}`;
              
              console.log(`Fetching metadata for ${car2.castingName}...`);
              metadata2 = await fetchModelMetadata(modelUrl);
              modelMetadataCache.set(car2.castingName, metadata2);
              await sleep(500);
            }
          }
          
          if (!metadata2) {
            metadata2 = {
              debutSeries: null,
              produced: null,
              designer: null,
              castingNumber: null,
              description: null,
            };
          }

          // Build description: Sütun 1-3 bilgileri + her iki arabanın Body Color, Wheel Type, Notes
          const descriptionParts: string[] = [];
          
          // Sütun 1-3 bilgileri: Toy#, Theme, Casting Names
          descriptionParts.push(`Toy#: ${car1.toyNumber}`);
          descriptionParts.push(`Theme: ${car1.theme}`);
          descriptionParts.push(`Casting Names: ${car1.castingName} & ${car2.castingName}`);
          descriptionParts.push('');
          
          // Car 1 details
          descriptionParts.push(`${car1.castingName}:`);
          if (car1.bodyColor) descriptionParts.push(`Body Color: ${car1.bodyColor}`);
          if (car1.wheelType) descriptionParts.push(`Wheel Type: ${car1.wheelType}`);
          if (car1.notes) descriptionParts.push(`Notes: ${car1.notes}`);
          
          descriptionParts.push('');
          
          // Car 2 details
          descriptionParts.push(`${car2.castingName}:`);
          if (car2.bodyColor) descriptionParts.push(`Body Color: ${car2.bodyColor}`);
          if (car2.wheelType) descriptionParts.push(`Wheel Type: ${car2.wheelType}`);
          if (car2.notes) descriptionParts.push(`Notes: ${car2.notes}`);

          const createdModel = await prisma.model.create({
            data: {
              castingName: modelName,
              castingId: car1.toyNumber,
              description: descriptionParts.join('\n') || null,
              debutSeries: metadata1.debutSeries || metadata2.debutSeries,
              produced: metadata1.produced || metadata2.produced,
              designer: metadata1.designer || metadata2.designer,
              castingNumber: metadata1.castingNumber || metadata2.castingNumber,
              collection: { connect: { id: collectionRecord!.id } },
              subSeries: { connect: { id: subSeries.id } },
            },
          });
          model = { id: createdModel.id };
          console.log(`Created Model: ${modelName} (${subSeriesName})`);
        }
        modelCache.set(modelKey, model);
      }

      // Create ONE Variant per 2-pack set
      // Variant releaseName: "Theme Casting Name 1 & Casting Name 2"
      const variantReleaseName = `${car1.theme} ${car1.castingName} & ${car2.castingName}`;
      
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          toyNumber: car1.toyNumber,
          year: targetYear,
          releaseName: variantReleaseName,
        },
      });
      
      if (!existingVariant) {
        await prisma.variant.create({
          data: {
            model: { connect: { id: model.id } },
            year: targetYear,
            releaseName: variantReleaseName,
            cardNumber: car1.theme,
            toyNumber: car1.toyNumber || undefined,
            isTreasureHunt: false,
            isSuperTreasureHunt: false,
            owned: false,
            quantity: 0,
          },
        });
        totalCreated++;
        console.log(`Created Variant: ${variantReleaseName}`);
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
