/**
 * Comprehensive script to scrape 2025 Hot Wheels Mainline data from Fandom Wiki
 * 
 * This script:
 * 1. Fetches the main table from List_of_2025_Hot_Wheels
 * 2. Extracts: Toy#, Col#, Model Name, Series, Series#, TH/STH info, Image URLs
 * 3. For each model, fetches detail page to get: Debut Series, Produced, Designer, Number, Description
 * 4. Downloads images in full resolution
 * 5. Saves everything to database with proper relationships
 * 
 * Usage:
 *   npx ts-node scripts/tools/scrape_2025_mainline_complete.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2025_Hot_Wheels';
const BASE_WIKI_URL = 'https://hotwheels.fandom.com';

// Rate limiting: wait between requests
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convert model name to safe folder slug
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Clean image URL to get full resolution
function cleanImageUrl(url: string): string {
  if (!url) return '';
  
  // Make absolute if needed
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    url = BASE_WIKI_URL + url;
  }
  
  // Remove thumbnail/scale parameters to get full size
  url = url
    .replace(/\/scale-to-width-down\/\d+/g, '')
    .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
    .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '/revision/latest');
  
  return url;
}

// Interface for table row data
interface TableRowData {
  toyNumber: string;
  collectorNumber: string;
  modelName: string;
  series: string;
  seriesNumber: string;
  isTreasureHunt: boolean;
  isSuperTreasureHunt: boolean;
  imageUrl: string;
  modelDetailUrl?: string;
}

// Interface for model detail data
interface ModelDetailData {
  debutSeries?: string;
  produced?: string;
  designer?: string;
  number?: string;
  description?: string;
}

// Parse the main table from the wiki page
async function parseMainTable(): Promise<TableRowData[]> {
  console.log('📥 Fetching main table from wiki...');
  const response = await fetch(MAINLINE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${MAINLINE_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find the main table
  const table = $('table').first();
  if (!table || table.length === 0) {
    throw new Error('Could not find the mainline table on the page');
  }

  const rows: TableRowData[] = [];
  const tableRows = table.find('tbody tr');

  console.log(`📊 Found ${tableRows.length} rows in table. Parsing...`);

  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];
    const cells = $(row).find('td');
    if (cells.length < 5) continue; // Skip incomplete rows

    const toyNumber = $(cells[0]).text().trim();
    const collectorNumber = $(cells[1]).text().trim();
    const modelNameCell = $(cells[2]);
    const modelName = modelNameCell.text().trim();
    const seriesCell = $(cells[3]);
    const series = seriesCell.text().trim();
    const seriesNumber = $(cells[4]).text().trim();
    
    // Clean series name - remove TH/STH markers for the series name itself
    // TH/STH info will be detected separately
    const cleanSeriesName = series.replace(/\*\*\[.*?\]\*\*/g, '').trim();

    // Extract image URL from the last cell (usually 6th column)
    const imageCell = cells.length > 5 ? $(cells[5]) : null;
    let imageUrl = '';
    if (imageCell) {
      const imgElement = imageCell.find('img').first();
      imageUrl = imgElement.attr('data-src') || imgElement.attr('src') || '';
      imageUrl = cleanImageUrl(imageUrl);
    }

    // Extract model detail URL from model name link
    let modelDetailUrl: string | undefined;
    const modelLink = modelNameCell.find('a').first();
    if (modelLink.length > 0) {
      const href = modelLink.attr('href');
      if (href) {
        modelDetailUrl = href.startsWith('http') ? href : BASE_WIKI_URL + href;
      }
    }

    // Check for TH/STH in series column - need to check both series and seriesNumber columns
    const seriesText = `${series} ${seriesNumber}`;
    const isTreasureHunt = /Treasure Hunt/i.test(seriesText) && !/Super Treasure Hunt/i.test(seriesText);
    const isSuperTreasureHunt = /Super Treasure Hunt/i.test(seriesText);

    rows.push({
      toyNumber,
      collectorNumber,
      modelName,
      series: cleanSeriesName || series, // Use cleaned series name
      seriesNumber,
      isTreasureHunt,
      isSuperTreasureHunt,
      imageUrl,
      modelDetailUrl,
    });
  }

  console.log(`✅ Parsed ${rows.length} rows from table`);
  return rows;
}

// Fetch model detail page and extract additional information
async function fetchModelDetails(modelDetailUrl: string): Promise<ModelDetailData> {
  if (!modelDetailUrl) {
    return {};
  }

  try {
    await sleep(500); // Rate limiting
    
    const response = await fetch(modelDetailUrl);
    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch model detail: ${modelDetailUrl} (${response.status})`);
      return {};
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const details: ModelDetailData = {};

    // Look for infobox or data table
    // Fandom wiki typically uses infobox tables with labels and values
    const infobox = $('.infobox, .infobox-table, table.infobox').first();
    
    if (infobox.length > 0) {
      // Try to find specific fields
      infobox.find('tr').each((_, row) => {
        const label = $(row).find('th, td:first-child').text().trim().toLowerCase();
        const value = $(row).find('td:last-child').text().trim();

        if (label.includes('debut') || label.includes('first')) {
          details.debutSeries = value;
        } else if (label.includes('produced') || label.includes('years')) {
          details.produced = value;
        } else if (label.includes('designer')) {
          details.designer = value;
        } else if (label.includes('number') && !label.includes('collector')) {
          details.number = value;
        }
      });
    }

    // Try to find description - usually in the first paragraph after infobox
    const content = $('.mw-parser-output, #content').first();
    const paragraphs = content.find('p');
    
    // Skip empty paragraphs and find first meaningful one
    for (let i = 0; i < paragraphs.length; i++) {
      const text = $(paragraphs[i]).text().trim();
      if (text.length > 50) { // Meaningful description
        details.description = text;
        break;
      }
    }

    return details;
  } catch (error) {
    console.warn(`⚠️  Error fetching model details from ${modelDetailUrl}:`, error);
    return {};
  }
}

// Download image and save to disk
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  if (!url || fs.existsSync(destPath)) {
    return false; // Already exists or no URL
  }

  try {
    await sleep(300); // Rate limiting for image downloads
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(destPath, buffer);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading image ${url}:`, error);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting 2025 Mainline Complete Scraper\n');
  console.log('='.repeat(60));
  
  // Force output flush
  process.stdout.write('Initializing...\n');

  const stats = {
    rowsProcessed: 0,
    modelsCreated: 0,
    variantsCreated: 0,
    imagesDownloaded: 0,
    imagesAssociated: 0,
    detailsFetched: 0,
    errors: 0,
  };

  try {
    // Ensure Year and Collection exist
    const targetYear = 2025;
    let yearRecord = await prisma.year.findFirst({ where: { year: targetYear } });
    if (!yearRecord) {
      yearRecord = await prisma.year.create({ data: { year: targetYear } });
      console.log(`✅ Created Year record for ${targetYear}`);
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
      console.log(`✅ Created Collection record for ${collectionName}`);
    }

    // Parse main table
    const tableRows = await parseMainTable();
    
    // Setup base directory for images
    const baseImageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2025', 'mainline');
    await fs.promises.mkdir(baseImageDir, { recursive: true });

    // Caches
    const subSeriesCache = new Map<string, { id: number }>();
    const modelCache = new Map<string, { id: number; detailsFetched: boolean }>();
    const modelDetailsCache = new Map<string, ModelDetailData>();

    console.log('\n📦 Processing rows...\n');

    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      stats.rowsProcessed++;

      try {
        // Parse model name and variant description
        let castingName = row.modelName;
        let variantDescription: string | null = null;
        const variantMatch = row.modelName.match(/^(.*)\s+\(([^)]+)\)$/);
        if (variantMatch) {
          castingName = variantMatch[1].trim();
          variantDescription = variantMatch[2].trim();
        }

        // Get or create SubSeries
        let subSeries = subSeriesCache.get(row.series);
        if (!subSeries) {
          const existing = await prisma.subSeries.findFirst({
            where: { name: row.series, collectionId: collectionRecord.id },
          });
          if (existing) {
            subSeries = { id: existing.id };
          } else {
            const created = await prisma.subSeries.create({
              data: {
                name: row.series,
                collection: { connect: { id: collectionRecord.id } },
              },
            });
            subSeries = { id: created.id };
          }
          subSeriesCache.set(row.series, subSeries);
        }

        // Get or create Model
        const modelKey = row.collectorNumber || castingName;
        let model = modelCache.get(modelKey);
        let modelDetails: ModelDetailData = {};

        if (!model) {
          // Check if model exists in DB
          const existingModel = await prisma.model.findFirst({
            where: {
              castingName: castingName,
              subSeriesId: subSeries.id,
            },
          });

          if (existingModel) {
            model = { id: existingModel.id, detailsFetched: false };
          } else {
            // Fetch model details if URL is available
            if (row.modelDetailUrl) {
              modelDetails = await fetchModelDetails(row.modelDetailUrl);
              stats.detailsFetched++;
            }

            // Create model with details in description as JSON
            const descriptionJson: any = {};
            if (modelDetails.debutSeries) descriptionJson.debutSeries = modelDetails.debutSeries;
            if (modelDetails.produced) descriptionJson.produced = modelDetails.produced;
            if (modelDetails.designer) descriptionJson.designer = modelDetails.designer;
            if (modelDetails.number) descriptionJson.number = modelDetails.number;
            if (modelDetails.description) descriptionJson.description = modelDetails.description;

            const createdModel = await prisma.model.create({
              data: {
                castingName,
                castingId: row.toyNumber,
                description: Object.keys(descriptionJson).length > 0 
                  ? JSON.stringify(descriptionJson, null, 2) 
                  : null,
                collection: { connect: { id: collectionRecord.id } },
                subSeries: { connect: { id: subSeries.id } },
              },
            });
            model = { id: createdModel.id, detailsFetched: true };
            stats.modelsCreated++;
            console.log(`✅ Created Model: ${castingName} (Col.# ${row.collectorNumber})`);
          }
          modelCache.set(modelKey, model);
          modelDetailsCache.set(modelKey, modelDetails);
        } else {
          modelDetails = modelDetailsCache.get(modelKey) || {};
        }

        // Check if variant already exists
        const existingVariant = await prisma.variant.findFirst({
          where: {
            modelId: model.id,
            cardNumber: row.collectorNumber,
            color: variantDescription ?? undefined,
          },
        });

        if (existingVariant) {
          // Update TH/STH status if needed
          if (existingVariant.isTreasureHunt !== row.isTreasureHunt || 
              existingVariant.isSuperTreasureHunt !== row.isSuperTreasureHunt) {
            await prisma.variant.update({
              where: { id: existingVariant.id },
              data: {
                isTreasureHunt: row.isTreasureHunt,
                isSuperTreasureHunt: row.isSuperTreasureHunt,
              },
            });
          }
          continue; // Skip duplicate
        }

        // Create Variant
        const variant = await prisma.variant.create({
          data: {
            model: { connect: { id: model.id } },
            year: targetYear,
            releaseName: row.series,
            color: variantDescription ?? undefined,
            cardNumber: row.collectorNumber,
            isTreasureHunt: row.isTreasureHunt,
            isSuperTreasureHunt: row.isSuperTreasureHunt,
            owned: false,
            quantity: 0,
          },
        });
        stats.variantsCreated++;

        // Download and associate image
        if (row.imageUrl) {
          const castingSlug = slugify(castingName);
          const targetFolder = path.join(baseImageDir, castingSlug);
          await fs.promises.mkdir(targetFolder, { recursive: true });

          // Determine file extension
          const urlObj = new URL(row.imageUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)(\?|$)/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const fileName = `${row.toyNumber}_${row.collectorNumber}.${ext}`;
          const destPath = path.join(targetFolder, fileName);

          const downloaded = await downloadImage(row.imageUrl, destPath);
          if (downloaded) {
            stats.imagesDownloaded++;
          }

          // Create Image record and associate with variant
          if (fs.existsSync(destPath)) {
            const relativePath = path.join('/images', 'hotwheels', '2025', 'mainline', castingSlug, fileName)
              .replace(/\\/g, '/');
            
            const imageRecord = await prisma.image.create({
              data: {
                path: relativePath,
                alt: `${castingName} - ${row.collectorNumber}`,
                variant: { connect: { id: variant.id } },
              },
            });

            await prisma.variant.update({
              where: { id: variant.id },
              data: { imageId: imageRecord.id },
            });
            stats.imagesAssociated++;
          }
        }

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`   Processed ${i + 1}/${tableRows.length} rows...`);
        }

      } catch (error) {
        stats.errors++;
        console.error(`❌ Error processing row ${i + 1} (${row.modelName}):`, error);
      }
    }

    // Final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`✅ Rows processed: ${stats.rowsProcessed}`);
    console.log(`✅ Models created: ${stats.modelsCreated}`);
    console.log(`✅ Variants created: ${stats.variantsCreated}`);
    console.log(`✅ Images downloaded: ${stats.imagesDownloaded}`);
    console.log(`✅ Images associated: ${stats.imagesAssociated}`);
    console.log(`✅ Model details fetched: ${stats.detailsFetched}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log('\n🎉 Scraping completed successfully!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










