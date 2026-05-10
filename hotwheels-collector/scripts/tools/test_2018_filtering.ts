/**
 * Script to test 2018 filtering logic
 * Tests the filtering logic manually using Prisma
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2018 filtering logic...\n');

  // Find Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: { year: 2018 },
    },
  });

  if (!mainlineCollection) {
    console.log('✗ ERROR: 2018 Mainline collection not found!');
    return;
  }

  // Test 1: Filter by year only (simulate what the service should do)
  console.log('Test 1: Filter by year=2018 only (should auto-filter to Mainline)');
  
  // This is what the service should do: auto-filter to Mainline when only year is provided
  const variantsYearOnly = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id, // Auto-filter to Mainline
      },
    },
    include: {
      model: {
        include: {
          collection: true,
          subSeries: true,
        },
      },
    },
  });
  
  console.log(`  Found ${variantsYearOnly.length} variants`);
  
  // Check if all variants are from Mainline collection
  const nonMainlineVariants = variantsYearOnly.filter(v => 
    v.model.collectionId !== mainlineCollection.id
  );
  
  if (nonMainlineVariants.length > 0) {
    console.log(`  ✗ ERROR: Found ${nonMainlineVariants.length} non-Mainline variants:`);
    nonMainlineVariants.slice(0, 5).forEach(v => {
      console.log(`    - ${v.model.castingName} (Collection: ${v.model.collection.name})`);
    });
  } else {
    console.log(`  ✓ All variants are from Mainline collection`);
  }
  
  // Check COL# range
  const colNumbers = variantsYearOnly
    .map(v => parseInt(v.cardNumber || '0'))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  const minCol = colNumbers[0] || 0;
  const maxCol = colNumbers[colNumbers.length - 1] || 0;
  console.log(`  COL# range: ${minCol} - ${maxCol}`);
  
  // Count variants with COL# >= 366
  const col366Plus = variantsYearOnly.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col >= 366;
  });
  console.log(`  COL# 366+ variants: ${col366Plus.length}`);
  
  // Count variants with COL# < 366 (should be 365)
  const colUnder366 = variantsYearOnly.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col < 366;
  });
  console.log(`  COL# < 366 variants: ${colUnder366.length} (should be 365)`);

  // Test 2: Check what happens if we DON'T filter by collection (should show all)
  console.log('\nTest 2: Filter by year=2018 WITHOUT collection filter (should show ALL collections)');
  const variantsAllCollections = await prisma.variant.findMany({
    where: {
      year: 2018,
    },
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
  });
  
  console.log(`  Found ${variantsAllCollections.length} variants from all collections`);
  
  // Group by collection
  const byCollection = new Map<string, number>();
  variantsAllCollections.forEach(v => {
    const name = v.model.collection.name;
    byCollection.set(name, (byCollection.get(name) || 0) + 1);
  });
  
  console.log('  Breakdown by collection:');
  byCollection.forEach((count, name) => {
    console.log(`    ${name}: ${count} variants`);
  });
  
  if (variantsAllCollections.length > variantsYearOnly.length) {
    console.log(`  ⚠️  WARNING: Without collection filter, ${variantsAllCollections.length - variantsYearOnly.length} more variants are shown`);
    console.log(`  This confirms the service needs to auto-filter to Mainline when only year is provided`);
  }

  // Test 3: Check all 2018 collections
  console.log('\nTest 3: All 2018 collections');
  const allCollections = await prisma.collection.findMany({
    where: { year: { year: 2018 } },
    include: {
      _count: { select: { models: true } },
    },
  });
  
  allCollections.forEach(c => {
    console.log(`  ${c.name}: ${c._count.models} models`);
  });

  // Test 4: Check if there are variants from other collections in 2018
  console.log('\nTest 4: Variants from non-Mainline collections in 2018');
  if (mainlineCollection) {
    const nonMainlineVariants = await prisma.variant.findMany({
      where: {
        year: 2018,
        model: {
          collectionId: { not: mainlineCollection.id },
        },
      },
      include: {
        model: {
          include: {
            collection: true,
          },
        },
      },
      take: 10,
    });
    
    if (nonMainlineVariants.length > 0) {
      console.log(`  Found ${nonMainlineVariants.length} non-Mainline variants (showing first 10):`);
      nonMainlineVariants.forEach(v => {
        console.log(`    - ${v.model.castingName} (Collection: ${v.model.collection.name})`);
      });
    } else {
      console.log(`  ✓ No non-Mainline variants found in 2018`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

