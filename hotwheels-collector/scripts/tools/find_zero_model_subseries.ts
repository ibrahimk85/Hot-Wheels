/**
 * Script to find all sub-series that have 0 models
 * 
 * This script queries the database to find all SubSeries records
 * that have no associated models.
 * 
 * How to use:
 *   npx ts-node scripts/tools/find_zero_model_subseries.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== FINDING SUB-SERIES WITH 0 MODELS ===\n');

  // Get all sub-series with their model counts
  const allSubSeries = await prisma.subSeries.findMany({
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      _count: {
        select: {
          models: true,
        },
      },
    },
    orderBy: [
      {
        collection: {
          year: {
            year: 'desc',
          },
        },
      },
      {
        name: 'asc',
      },
    ],
  });

  // Filter sub-series with 0 models
  const zeroModelSubSeries = allSubSeries.filter(
    (ss) => ss._count.models === 0
  );

  console.log(`Total Sub-Series: ${allSubSeries.length}`);
  console.log(`Sub-Series with 0 models: ${zeroModelSubSeries.length}\n`);

  if (zeroModelSubSeries.length === 0) {
    console.log('✅ No sub-series with 0 models found!');
    await prisma.$disconnect();
    return;
  }

  // Group by collection name
  const groupedByCollection = new Map<string, typeof zeroModelSubSeries>();
  
  for (const ss of zeroModelSubSeries) {
    const collectionName = ss.collection.name;
    if (!groupedByCollection.has(collectionName)) {
      groupedByCollection.set(collectionName, []);
    }
    groupedByCollection.get(collectionName)!.push(ss);
  }

  console.log('=== SUB-SERIES WITH 0 MODELS ===\n');
  
  // Display grouped by collection
  for (const [collectionName, subSeriesList] of Array.from(groupedByCollection.entries()).sort()) {
    console.log(`\n📦 ${collectionName} (${subSeriesList.length} sub-series):`);
    console.log('─'.repeat(60));
    
    for (const ss of subSeriesList) {
      console.log(`  • ${ss.name} (Year: ${ss.collection.year.year}, ID: ${ss.id})`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\nSUMMARY:');
  console.log(`Total Sub-Series: ${allSubSeries.length}`);
  console.log(`Sub-Series with 0 models: ${zeroModelSubSeries.length}`);
  console.log(`Sub-Series with models: ${allSubSeries.length - zeroModelSubSeries.length}`);
  
  // Collection breakdown
  console.log('\nBy Collection:');
  for (const [collectionName, subSeriesList] of Array.from(groupedByCollection.entries()).sort()) {
    console.log(`  ${collectionName}: ${subSeriesList.length} sub-series with 0 models`);
  }
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




