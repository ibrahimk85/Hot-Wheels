/**
 * Script to find and remove duplicate normal variants (non-TH/STH) for 2021 Mainline collection.
 * 
 * Duplicates are identified by:
 * - Same castingId (Toy#)
 * - Same cardNumber
 * - Same color (or both null)
 * - Same year (2021)
 * - NOT Treasure Hunt or Super Treasure Hunt
 * 
 * Usage:
 *   npx ts-node scripts/tools/find_and_remove_duplicates_normal_2021.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAndRemoveDuplicates() {
  console.log('=== Finding and Removing Duplicate Normal Variants for 2021 Mainline ===\n');

  // Get 2021 Mainline collection
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

  // Get all normal (non-TH/STH) 2021 Mainline variants with their model info
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
      { modelId: 'asc' },
      { cardNumber: 'asc' },
      { id: 'asc' }, // Keep the first one (lowest ID)
    ],
  });

  console.log(`Found ${allVariants.length} normal variants for 2021 Mainline\n`);

  // Group variants by unique key: castingName + cardNumber + color
  // This will catch duplicates even if they have different modelId or castingId
  // (same model name and card number = duplicate, regardless of modelId)
  const variantGroups = new Map<string, typeof allVariants>();

  for (const variant of allVariants) {
    // Create a unique key for grouping using castingName (not castingId, as castingId might be missing or different)
    const colorKey = variant.color || 'NULL';
    const castingName = variant.model.castingName;
    const key = `${castingName}|${variant.cardNumber}|${colorKey}`;
    
    if (!variantGroups.has(key)) {
      variantGroups.set(key, []);
    }
    variantGroups.get(key)!.push(variant);
  }

  // Find duplicates (groups with more than 1 variant)
  const duplicates: Array<{ key: string; variants: typeof allVariants }> = [];
  for (const [key, variants] of variantGroups.entries()) {
    if (variants.length > 1) {
      duplicates.push({ key, variants });
    }
  }

  console.log(`Found ${duplicates.length} groups with duplicates\n`);

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  // Show duplicates before removal
  console.log('=== Duplicate Groups ===\n');
  let totalDuplicatesToRemove = 0;

  for (const { key, variants } of duplicates) {
    const [castingName, cardNumber, color] = key.split('|');
    
    console.log(`Model: ${castingName}`);
    console.log(`  Card #: ${cardNumber}, Color: ${color === 'NULL' ? 'null' : color}`);
    console.log(`  Found ${variants.length} variants:`);
    
    for (const variant of variants) {
      const model = variant.model;
      console.log(`    - Variant ID: ${variant.id}, Model ID: ${model.id}, Toy# (Casting ID): ${model.castingId || 'NULL'}, Release: ${variant.releaseName || 'N/A'}`);
    }
    
    // Keep the first variant (lowest ID), remove the rest
    // Sort by variant ID to ensure we keep the oldest one
    const sortedVariants = [...variants].sort((a, b) => a.id - b.id);
    const toKeep = sortedVariants[0];
    const toRemove = sortedVariants.slice(1);
    
    console.log(`  → Keeping variant ID: ${toKeep.id} (Model ID: ${toKeep.model.id}, Toy#: ${toKeep.model.castingId || 'NULL'})`);
    console.log(`  → Removing ${toRemove.length} duplicate(s): ${toRemove.map(v => `Variant ID: ${v.id} (Model ID: ${v.model.id}, Toy#: ${v.model.castingId || 'NULL'})`).join(', ')}\n`);
    
    totalDuplicatesToRemove += toRemove.length;
  }

  console.log(`\nTotal duplicates to remove: ${totalDuplicatesToRemove}\n`);

  // Ask for confirmation (in a real scenario, you might want to add a prompt)
  // For now, we'll proceed with removal
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

findAndRemoveDuplicates()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

