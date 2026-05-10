/**
 * Script to download image assets for the 2010 USA Hot Wheels Mainline and
 * associate them with Variant records in your database.
 *
 * This script processes ALL tables from the 2010 wiki page, where each table
 * represents a different sub-series. It extracts image URLs and matches them
 * to variants using Toy#.
 *
 * **Important notes:**
 *   - Before running this script, ensure that you have already imported
 *     the 2010 USA mainline variants using the import script provided earlier.
 *   - CRITICAL: 2010'da 2nd/3rd color varyantları aynı COL# ama farklı Toy#.
 *     Bu nedenle eşleştirme öncelikle Toy# ile yapılır.
 *   - Running this script multiple times is safe; it will only download
 *     missing images and create missing associations.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFandomWikiHtml, downloadFandomBinary } from '../lib/fandom-fetch.ts';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const MAINLINE_URL = 'https://hotwheels.fandom.com/wiki/List_of_2010_Hot_Wheels';

/**
 * Convert a casting name into a safe folder slug.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  await downloadFandomBinary(url, dest);
}

async function main() {
  console.log('Fetching 2010 USA mainline page…');
  const html = await fetchFandomWikiHtml(MAINLINE_URL);
  const $ = cheerio.load(html);

  // Find 2010 Mainline collection (same Year for both USA and International)
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2010,
        notes: null, // Use the same Year record without notes
      },
    },
  });
  
  if (!mainlineCollection) {
    throw new Error('2010 Mainline collection not found. Please import data first.');
  }

  // Find the "Mainline (USA)" SubSeries
  const usaSubSeries = await prisma.subSeries.findFirst({
    where: {
      name: 'Mainline (USA)',
      collectionId: mainlineCollection.id,
    },
  });

  if (!usaSubSeries) {
    throw new Error('Mainline (USA) SubSeries not found. Please import data first.');
  }

  // Find ALL tables on the page
  const allTables = $('table');
  console.log(`Found ${allTables.length} tables on the page`);

  // Base folder for image storage
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2010', 'usa', 'mainline');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownloadCount = 0;
  let totalAssociatedCount = 0;

  // Process each table (use for loop to allow await)
  const tablesArray: any[] = [];
  allTables.each((index, tableElement) => {
    tablesArray.push($(tableElement));
  });

  for (let tableIndex = 0; tableIndex < tablesArray.length; tableIndex++) {
    const table = tablesArray[tableIndex];
    const rows = table.find('tbody tr, tr');
    
    if (rows.length < 2) {
      continue; // Skip tables with too few rows
    }
    
    console.log(`\nProcessing table ${tableIndex + 1} (${rows.length} rows)...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = $(row).find('td');
      if (cells.length === 0) continue;

      // Extract data from row (Column 1: Toy#, Column 2: COL#, Column 3: Model Name)
      const toyNumber = $(cells[0]).text().trim();
      if (!toyNumber || toyNumber.length === 0) continue;
      
      const collectorNumberStr = $(cells[1]).text().trim();
      const modelNameRaw = $(cells[2]).text().trim();
      const subSeriesName = $(cells[3]).text().trim();
      
      // Parse Model Name to get casting name and color variant
      // Handle cases like: "Nissan Skyline GT-R (R34) (2nd Color)" or "'67 Shelby GT500 (2nd Color)"
      let castingName = modelNameRaw;
      let colorVariant: string | null = null;
      
      // Check if it ends with color variant pattern (2nd Color, 3rd Color, etc.)
      const colorVariantMatch = modelNameRaw.match(/^(.*?)\s*\((2nd|3rd|4th|5th)\s+Color\)$/i);
      if (colorVariantMatch) {
        castingName = colorVariantMatch[1].trim();
        colorVariant = colorVariantMatch[2].trim() + ' Color';
      } else {
        // Check for other patterns like "(R34)" - these are part of casting name, not color
        // Only treat as color if it's explicitly a color variant
        const otherMatch = modelNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (otherMatch) {
          const innerText = otherMatch[2].trim();
          // Only treat as color if it contains "Color" keyword
          if (innerText.toLowerCase().includes('color')) {
            castingName = otherMatch[1].trim();
            colorVariant = innerText;
          }
          // Otherwise, keep the full name as casting name (e.g., "Nissan Skyline GT-R (R34)")
        }
      }
      
      // Image element is in the last cell (usually index 5)
      const imgElement = $(cells[cells.length - 1]).find('img').first();
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
      const altText = imgElement.attr('alt') || modelNameRaw;
      
      if (!imgUrl) {
        continue; // Skip rows without an image
      }
      
      // Ensure the URL is absolute
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }
      
      // Remove thumbnail/scale modifiers
      let fullImgUrl = imgUrl
        .replace(/\/scale-to-width-down\/\d+/g, '')
        .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');


      // Build safe folder path for this casting
      const castingSlug = slugify(castingName);
      const targetFolder = path.join(baseDir, castingSlug);
      await fs.promises.mkdir(targetFolder, { recursive: true });

      // Determine file extension
      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      
      // CRITICAL FIX: Create unique filename using Column1 (Toy#), Column2 (Col#), and Color variant from Column3
      // This ensures each row's image is saved separately, even if Toy# and Col# are the same
      // Example: R0916_001_1st.jpg, R0916_001_2nd.jpg, R0916_001_3rd.jpg
      const colorSuffix = colorVariant ? slugify(colorVariant.replace(' Color', '')) : '1st'; // "2nd Color" -> "2nd", "3rd Color" -> "3rd"
      const safeColNumber = collectorNumberStr ? collectorNumberStr.padStart(3, '0') : 'N'; // Pad with zeros for consistency
      const fileName = `${toyNumber}_${safeColNumber}_${colorSuffix}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      // Download the image if not already downloaded
      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          totalDownloadCount++;
          console.log(`  📥 Downloaded: ${modelNameRaw} → ${fileName}`);
        } catch (err) {
          console.error(`  ❌ Error downloading ${fullImgUrl}:`, err);
          continue;
        }
      } else {
        // Image already exists, but we still need to associate it
        if (totalDownloadCount < 5) {
          console.log(`  ℹ️  Image exists: ${fileName}`);
        }
      }

      // Find variant by Toy# + COL# + Color (Column 1, 2, and parsed color from Column 3)
      // Model Name is used for validation
      
      // Step 1: Find all variants with this Toy# in the correct SubSeries
      const allVariantsWithToy = await prisma.variant.findMany({
        where: {
          toyNumber: toyNumber,
          year: 2010,
          model: {
            collectionId: mainlineCollection.id,
            subSeriesId: usaSubSeries.id,
          },
        },
        include: { model: true },
      });
      
      if (allVariantsWithToy.length === 0) {
        // Try without SubSeries filter (fallback)
        const allVariantsWithToyNoSub = await prisma.variant.findMany({
          where: {
            toyNumber: toyNumber,
            year: 2010,
            model: {
              collectionId: mainlineCollection.id,
            },
          },
          include: { model: true },
        });
        
        if (allVariantsWithToyNoSub.length === 0) {
          console.warn(`  ⚠️  No variants found with Toy# ${toyNumber} in Mainline (USA)`);
          continue;
        } else {
          // Use variants from other SubSeries (shouldn't happen but fallback)
          allVariantsWithToy.push(...allVariantsWithToyNoSub);
        }
      }
      
      // Step 2: Filter by COL# (Column 2) - exact match required
      let candidates = allVariantsWithToy;
      if (collectorNumberStr && collectorNumberStr.trim() !== '') {
        candidates = allVariantsWithToy.filter(v => v.cardNumber === collectorNumberStr);
      }
      
      if (candidates.length === 0) {
        console.warn(`  ⚠️  No variant found for ${modelNameRaw} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr})`);
        continue;
      }
      
      // Step 3: Match by Model Name (Column 3) - casting name must match exactly
      // Parse casting name from Model Name column
      const wikiCastingNameLower = castingName.toLowerCase().trim();
      
      // Step 4: Filter by color variant from Model Name (Column 3)
      let variant = null;
      
      if (colorVariant) {
        // Match by color variant (2nd Color, 3rd Color, etc.)
        variant = candidates.find(v => {
          const dbCastingNameLower = v.model.castingName.toLowerCase().trim();
          const colorMatch = v.color === colorVariant;
          const castingMatch = dbCastingNameLower === wikiCastingNameLower;
          return castingMatch && colorMatch;
        });
      } else {
        // No color variant in Model Name - match 1st Color (color is null or empty)
        variant = candidates.find(v => {
          const dbCastingNameLower = v.model.castingName.toLowerCase().trim();
          const castingMatch = dbCastingNameLower === wikiCastingNameLower;
          const noColor = !v.color || v.color.trim() === '';
          return castingMatch && noColor;
        });
      }
      
      // Step 5: If still no exact match, try fuzzy match on casting name
      if (!variant && candidates.length > 0) {
        for (const v of candidates) {
          const dbCastingNameLower = v.model.castingName.toLowerCase().trim();
          // Try exact match first
          if (dbCastingNameLower === wikiCastingNameLower) {
            variant = v;
            break;
          }
          // Try match without parentheses (e.g., "Nissan Skyline GT-R (R34)" vs "Nissan Skyline GT-R")
          const wikiBase = wikiCastingNameLower.split('(')[0].trim();
          const dbBase = dbCastingNameLower.split('(')[0].trim();
          if (wikiBase === dbBase && wikiBase.length > 0) {
            // Also check color if we have one
            if (colorVariant) {
              if (v.color === colorVariant) {
                variant = v;
                break;
              }
            } else {
              if (!v.color || v.color.trim() === '') {
                variant = v;
                break;
              }
            }
          }
        }
      }

      if (!variant) {
        console.warn(`  ⚠️  Variant not found for ${modelNameRaw} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr})`);
        continue;
      }

      // Check if variant already has an image assigned
      // But still process to ensure correct association
      const hasImage = variant.imageId !== null && variant.imageId !== undefined;
      
      // Log successful match (for first 20 matches)
      if (totalAssociatedCount < 20) {
        console.log(`  ✓ Matched: ${modelNameRaw} → ${variant.model.castingName} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr || 'N/A'}, Color: ${variant.color || 'none'})`);
      }

      // Create Image record and associate with BOTH variant AND model
      // Mainline images are displayed from model.images first, then variant.images as fallback
      const relativePath = path.join('/images', 'hotwheels', '2010', 'usa', 'mainline', castingSlug, fileName).replace(/\\/g, '/');
      try {
        // Check if image already exists in database
        let imageRecord = await prisma.image.findFirst({
          where: {
            path: relativePath,
          },
        });

        if (!imageRecord) {
          // Create new image record associated with both variant and model
          imageRecord = await prisma.image.create({
            data: {
              path: relativePath,
              alt: altText,
              variant: { connect: { id: variant.id } },
              model: { connect: { id: variant.modelId } }, // Also connect to model for Mainline
            },
          });
        } else {
          // Image exists, update connections if needed
          const updateData: any = {};
          if (imageRecord.variantId !== variant.id) {
            updateData.variantId = variant.id;
          }
          if (imageRecord.modelId !== variant.modelId) {
            updateData.modelId = variant.modelId;
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.image.update({
              where: { id: imageRecord.id },
              data: updateData,
            });
          }
        }

        // Update variant with imageId
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: imageRecord.id },
        });
        totalAssociatedCount++;
        if (totalAssociatedCount <= 20 || totalAssociatedCount % 50 === 0) {
          console.log(`  ✅ Associated: ${modelNameRaw} (Toy#: ${toyNumber}, COL#: ${collectorNumberStr || 'N/A'})`);
        }
      } catch (err) {
        console.error(`  ❌ Error creating image record for ${modelNameRaw}:`, err);
      }
    }
  }

  console.log(`\n✅ Download complete. ${totalDownloadCount} images downloaded, ${totalAssociatedCount} variants updated.`);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
