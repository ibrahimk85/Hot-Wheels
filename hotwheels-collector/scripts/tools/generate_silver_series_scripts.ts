/**
 * Script Generator: Silver Series Import and Image Download Scripts
 * 
 * This script:
 *   1. Reads the analysis JSON file (themed_assortment_analysis.json)
 *   2. Generates import scripts for each collection
 *   3. Generates image download scripts for each collection
 *   4. Uses templates based on existing scripts (Stars & Stripes, Neon Speeders)
 * 
 * Usage:
 *   npx ts-node scripts/tools/generate_silver_series_scripts.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const ANALYSIS_FILE = path.join(process.cwd(), 'scripts', 'data', 'themed_assortment_analysis.json');
const IMPORT_TEMPLATE = path.join(process.cwd(), 'scripts', 'import', 'import_stars_stripes.ts');
const IMAGE_TEMPLATE = path.join(process.cwd(), 'scripts', 'tools', 'download_stars_stripes_images.ts');

interface CollectionInfo {
  name: string;
  segment: string;
  years: number[];
  wikiUrl: string | null;
  hasLink: boolean;
  tableStructure?: {
    columns: number;
    columnNames: string[];
    imageColumns: number[];
    imageTypes: string[];
    toyNumberColumn?: number;
    castingNameColumn?: number;
    yearColumn?: number;
  };
  notes?: string;
}

interface AnalysisResult {
  collections: CollectionInfo[];
}

/**
 * Convert collection name to slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate import script for a collection
 */
function generateImportScript(collection: CollectionInfo): string {
  const slug = slugify(collection.name);
  const scriptName = `import_silver_series_${slug}.ts`;
  
  // Read template
  const template = fs.readFileSync(IMPORT_TEMPLATE, 'utf-8');
  
  // Replace placeholders
  let script = template
    .replace(/Stars & Stripes Series/g, `${collection.name} Series`)
    .replace(/Stars & Stripes/g, collection.name)
    .replace(/Stars_%26_Stripes_Series/g, encodeURIComponent(collection.name.replace(/\s+/g, '_') + '_Series'))
    .replace(/const YEARS = \[2016, 2018, 2020, 2022, 2024\];/g, `const YEARS = [${collection.years.join(', ')}];`)
    .replace(/const collectionName = 'Stars & Stripes';/g, `const collectionName = '${collection.name}';`)
    .replace(/Collection \(Stars & Stripes\)/g, `Collection (${collection.name})`)
    .replace(/Stars & Stripes Series-specific:/g, `${collection.name} Series-specific:`)
    .replace(/SubSeries: Year name/g, `SubSeries: ${collection.name}`)
    .replace(/\/\/ All years have the same structure for Stars & Stripes/g, `// Table structure for ${collection.name}`);

  // Add wiki URL if available
  if (collection.wikiUrl) {
    script = script.replace(
      /const wikiUrl = `https:\/\/hotwheels\.fandom\.com\/wiki\/Stars_%26_Stripes_Series`;/g,
      `const wikiUrl = \`${collection.wikiUrl}\`;`
    );
  } else {
    // If no link, add a placeholder
    script = script.replace(
      /const wikiUrl = `https:\/\/hotwheels\.fandom\.com\/wiki\/Stars_%26_Stripes_Series`;/g,
      `// TODO: Add wiki URL for ${collection.name}\n  const wikiUrl = \`\`;`
    );
  }

  // Update table structure comments based on analysis
  if (collection.tableStructure) {
    const tableComment = `// Table structure for ${collection.name} (${collection.tableStructure.columns} columns):
// ${collection.tableStructure.columnNames.map((name, idx) => `Column ${idx}: ${name}`).join(', ')}
// Image columns: ${collection.tableStructure.imageColumns.map(idx => collection.tableStructure!.columnNames[idx]).join(', ')}`;
    
    script = script.replace(
      /\/\/ Table structure for Stars & Stripes \(9 columns\):[\s\S]*?\/\/ Column 8: Photo Carded/g,
      tableComment
    );
  }

  // Update header comment
  script = script.replace(
    /Script to import the Stars & Stripes Series set/g,
    `Script to import the ${collection.name} Series set (Silver Series)`
  );

  return script;
}

/**
 * Generate image download script for a collection
 */
function generateImageScript(collection: CollectionInfo): string {
  const slug = slugify(collection.name);
  const scriptName = `download_silver_series_${slug}_images.ts`;
  
  // Read template
  const template = fs.readFileSync(IMAGE_TEMPLATE, 'utf-8');
  
  // Replace placeholders
  let script = template
    .replace(/Stars & Stripes Series/g, `${collection.name} Series`)
    .replace(/Stars & Stripes/g, collection.name)
    .replace(/Stars_%26_Stripes_Series/g, encodeURIComponent(collection.name.replace(/\s+/g, '_') + '_Series'))
    .replace(/const YEARS = \[2016, 2018, 2020, 2022, 2024\];/g, `const YEARS = [${collection.years.join(', ')}];`)
    .replace(/name: 'Stars & Stripes'/g, `name: '${collection.name}'`)
    .replace(/\/images\/hotwheels\/\$\{year\}\/stars-stripes/g, `/images/hotwheels/\${year}/silver-series/${slug}`)
    .replace(/\/images\/hotwheels\/\$\{year\}\/stars-stripes/g, `/images/hotwheels/\${year}/silver-series/${slug}`);

  // Add wiki URL if available
  if (collection.wikiUrl) {
    script = script.replace(
      /const wikiUrl = `https:\/\/hotwheels\.fandom\.com\/wiki\/Stars_%26_Stripes_Series`;/g,
      `const wikiUrl = \`${collection.wikiUrl}\`;`
    );
  } else {
    script = script.replace(
      /const wikiUrl = `https:\/\/hotwheels\.fandom\.com\/wiki\/Stars_%26_Stripes_Series`;/g,
      `// TODO: Add wiki URL for ${collection.name}\n  const wikiUrl = \`\`;`
    );
  }

  // Update image types based on table structure
  if (collection.tableStructure && collection.tableStructure.imageTypes.length > 0) {
    const imageTypesConfig = collection.tableStructure.imageTypes.map((type, idx) => {
      const colIdx = collection.tableStructure!.imageColumns[idx];
      const isMain = type === 'carded';
      return `    { type: '${type}', order: ${idx + 1}, columnIndex: ${colIdx}, isMain: ${isMain} },`;
    }).join('\n');

    script = script.replace(
      /function getImageTypesForYear\(year: number\) \{[\s\S]*?\} as const;/g,
      `function getImageTypesForYear(year: number) {\n  return [\n${imageTypesConfig}\n  ] as const;\n}`
    );
  }

  // Update header comment
  script = script.replace(
    /Script to download images for Stars & Stripes Series variants/g,
    `Script to download images for ${collection.name} Series variants (Silver Series)`
  );

  return script;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== SILVER SERIES SCRIPT GENERATOR ===\n');

    // Read analysis file
    if (!fs.existsSync(ANALYSIS_FILE)) {
      console.error(`Analysis file not found: ${ANALYSIS_FILE}`);
      console.error('Please run analyze_themed_assortment_wiki.ts first!');
      process.exit(1);
    }

    const analysisData: AnalysisResult = JSON.parse(
      fs.readFileSync(ANALYSIS_FILE, 'utf-8')
    );

    console.log(`Found ${analysisData.collections.length} collections to process\n`);

    // Create output directories
    const importDir = path.join(process.cwd(), 'scripts', 'import');
    const toolsDir = path.join(process.cwd(), 'scripts', 'tools');

    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }

    let generatedCount = 0;
    let skippedCount = 0;

    // Generate scripts for each collection
    for (const collection of analysisData.collections) {
      const slug = slugify(collection.name);
      const importScriptPath = path.join(importDir, `import_silver_series_${slug}.ts`);
      const imageScriptPath = path.join(toolsDir, `download_silver_series_${slug}_images.ts`);

      // Skip if scripts already exist
      if (fs.existsSync(importScriptPath) || fs.existsSync(imageScriptPath)) {
        console.log(`⚠ Skipping ${collection.name} (scripts already exist)`);
        skippedCount++;
        continue;
      }

      // Generate import script
      if (collection.hasLink || !collection.hasLink) { // Generate for both with and without links
        const importScript = generateImportScript(collection);
        fs.writeFileSync(importScriptPath, importScript);
        console.log(`✓ Generated import script: import_silver_series_${slug}.ts`);
      }

      // Generate image script (only if has link)
      if (collection.hasLink && collection.tableStructure) {
        const imageScript = generateImageScript(collection);
        fs.writeFileSync(imageScriptPath, imageScript);
        console.log(`✓ Generated image script: download_silver_series_${slug}_images.ts`);
      } else if (!collection.hasLink) {
        console.log(`⚠ Skipping image script for ${collection.name} (no link available)`);
      }

      generatedCount++;
    }

    console.log(`\n=== GENERATION COMPLETE ===`);
    console.log(`  - Scripts generated: ${generatedCount}`);
    console.log(`  - Scripts skipped: ${skippedCount}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review generated scripts`);
    console.log(`  2. Update wiki URLs for collections without links`);
    console.log(`  3. Run import scripts: npx ts-node scripts/import/import_silver_series_<name>.ts`);
    console.log(`  4. Run image scripts: npx ts-node scripts/tools/download_silver_series_<name>_images.ts`);

  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main();
