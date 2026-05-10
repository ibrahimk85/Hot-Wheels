/**
 * Script to find duplicates by Toy# + Card# (ignoring color) for 2021 Mainline normal variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicates() {
  console.log('=== Finding Duplicates by Toy# + Card# for 2021 Mainline Normal Variants ===\n');

  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2021,
      },
    },
  });

  if (!mainlineCollection) {
    console.error('❌ 2021 Mainline collection not found!');
    return;
  }

  // Get all normal variants
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2021,
      isTreasureHunt: false,
      isSuperTreasureHunt: false,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: {
        select: {
          id: true,
          castingName: true,
          castingId: true,
        },
      },
    },
    orderBy: [
      { id: 'asc' },
    ],
  });

  console.log(`Total normal variants: ${allVariants.length}\n`);

  // Group by Toy# (castingId) + Card# (ignoring color)
  const groups = new Map<string, typeof allVariants>();
  
  for (const variant of allVariants) {
    const castingId = variant.model.castingId;
    if (!castingId) continue; // Skip variants without castingId
    
    const key = `${castingId}|${variant.cardNumber}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(variant);
  }

  // Find groups with multiple variants
  const duplicates: Array<{ key: string; variants: typeof allVariants }> = [];
  for (const [key, variants] of groups.entries()) {
    if (variants.length > 1) {
      duplicates.push({ key, variants });
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found by Toy# + Card#\n');
  } else {
    console.log(`⚠️  Found ${duplicates.length} duplicate groups by Toy# + Card#:\n`);
    
    let totalToRemove = 0;
    
    for (const { key, variants } of duplicates) {
      const [castingId, cardNumber] = key.split('|');
      console.log(`Toy#: ${castingId}, Card#: ${cardNumber}`);
      console.log(`  Found ${variants.length} variants:`);
      
      // Sort by variant ID to keep the first one
      const sortedVariants = [...variants].sort((a, b) => a.id - b.id);
      
      for (let i = 0; i < sortedVariants.length; i++) {
        const variant = sortedVariants[i];
        const model = variant.model;
        const isFirst = i === 0;
        const marker = isFirst ? '✓ KEEP' : '✗ REMOVE';
        console.log(`    ${marker} - Variant ID: ${variant.id}, Model ID: ${model.id}, Model: ${model.castingName}, Color: ${variant.color || 'null'}, Release: ${variant.releaseName || 'N/A'}`);
      }
      
      totalToRemove += sortedVariants.length - 1;
      console.log('');
    }
    
    console.log(`\nTotal duplicates to remove: ${totalToRemove}\n`);
    
    // Ask if user wants to proceed
    console.log('Removing duplicates...\n');
    
    let removedCount = 0;
    let errorCount = 0;
    
    for (const { variants } of duplicates) {
      const sortedVariants = [...variants].sort((a, b) => a.id - b.id);
      const toRemove = sortedVariants.slice(1); // Keep first, remove rest
      
      for (const variant of toRemove) {
        try {
          // Delete associated images first (if any)
          await prisma.image.deleteMany({
            where: {
              variantId: variant.id,
            },
          });

          // Delete the variant
          await prisma.variant.delete({
            where: { id: variant.id },
          });

          removedCount++;
          console.log(`✓ Removed duplicate variant ID: ${variant.id} (Model: ${variant.model.castingName})`);
        } catch (error) {
          errorCount++;
          console.error(`✗ Error removing variant ID ${variant.id}:`, error);
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total duplicate groups found: ${duplicates.length}`);
    console.log(`Variants removed: ${removedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\n✅ Duplicate removal completed!');
  }
}

findDuplicates()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















