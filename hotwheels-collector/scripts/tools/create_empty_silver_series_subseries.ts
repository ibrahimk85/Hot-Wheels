/**
 * Script to create empty SubSeries for collections without links
 * 
 * This script:
 *   1. Reads the analysis JSON file
 *   2. Finds collections without links
 *   3. Creates empty SubSeries for them in Silver Series
 *   4. These can be populated later when links are available
 * 
 * Usage:
 *   npx ts-node scripts/tools/create_empty_silver_series_subseries.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const ANALYSIS_FILE = path.join(process.cwd(), 'scripts', 'data', 'themed_assortment_analysis.json');

interface CollectionInfo {
  name: string;
  segment: string;
  years: number[];
  wikiUrl: string | null;
  hasLink: boolean;
  notes?: string;
}

interface AnalysisResult {
  collections: CollectionInfo[];
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== CREATING EMPTY SILVER SERIES SUBSERIES ===\n');

    // Read analysis file
    if (!fs.existsSync(ANALYSIS_FILE)) {
      console.error(`Analysis file not found: ${ANALYSIS_FILE}`);
      console.error('Please run analyze_themed_assortment_wiki.ts first!');
      process.exit(1);
    }

    const analysisData: AnalysisResult = JSON.parse(
      fs.readFileSync(ANALYSIS_FILE, 'utf-8')
    );

    // Filter collections without links
    const collectionsWithoutLinks = analysisData.collections.filter(
      c => !c.hasLink
    );

    console.log(`Found ${collectionsWithoutLinks.length} collections without links\n`);

    if (collectionsWithoutLinks.length === 0) {
      console.log('No collections without links found. Exiting.');
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    // Get all years
    const allYears = new Set<number>();
    for (const collection of collectionsWithoutLinks) {
      if (collection.years.length > 0) {
        collection.years.forEach(year => allYears.add(year));
      } else {
        // If no years specified, use current year as default
        allYears.add(new Date().getFullYear());
      }
    }

    // Ensure Silver Series collections exist for all years
    for (const year of allYears) {
      let yearRecord = await prisma.year.findFirst({ where: { year } });
      if (!yearRecord) {
        yearRecord = await prisma.year.create({ data: { year } });
        console.log(`Created Year record for ${year}`);
      }

      let silverSeriesCollection = await prisma.collection.findFirst({
        where: {
          name: 'Hot Wheels Silver Series',
          yearId: yearRecord.id,
        },
      });

      if (!silverSeriesCollection) {
        silverSeriesCollection = await prisma.collection.create({
          data: {
            name: 'Hot Wheels Silver Series',
            code: 'Silver Series',
            yearId: yearRecord.id,
          },
        });
        console.log(`Created Silver Series collection for year ${year}`);
      }
    }

    // Create SubSeries for each collection without link
    for (const collection of collectionsWithoutLinks) {
      const years = collection.years.length > 0 
        ? collection.years 
        : [new Date().getFullYear()]; // Default to current year if no years specified

      for (const year of years) {
        const yearRecord = await prisma.year.findFirst({ where: { year } });
        if (!yearRecord) {
          console.warn(`Year ${year} not found, skipping...`);
          continue;
        }

        const silverSeriesCollection = await prisma.collection.findFirst({
          where: {
            name: 'Hot Wheels Silver Series',
            yearId: yearRecord.id,
          },
        });

        if (!silverSeriesCollection) {
          console.warn(`Silver Series collection not found for year ${year}, skipping...`);
          continue;
        }

        // Check if SubSeries already exists
        const existingSubSeries = await prisma.subSeries.findFirst({
          where: {
            name: collection.name,
            collectionId: silverSeriesCollection.id,
          },
        });

        if (existingSubSeries) {
          console.log(`SubSeries "${collection.name}" already exists for year ${year}`);
          skippedCount++;
          continue;
        }

        // Create empty SubSeries
        await prisma.subSeries.create({
          data: {
            name: collection.name,
            collectionId: silverSeriesCollection.id,
          },
        });

        console.log(`✓ Created empty SubSeries: "${collection.name}" (${year})`);
        createdCount++;
      }
    }

    console.log(`\n=== COMPLETED ===`);
    console.log(`  - SubSeries created: ${createdCount}`);
    console.log(`  - SubSeries skipped: ${skippedCount}`);
    console.log(`\nThese SubSeries are empty and can be populated later when wiki links are available.`);

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
