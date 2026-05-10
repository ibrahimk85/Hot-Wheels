/**
 * Script to remove duplicate Super Treasure Hunt variants from 2025 Mainline
 * that were created without images (duplicate entries)
 *
 * This script:
 * 1. Finds all 2025 Mainline variants marked as Super Treasure Hunt
 * 2. Filters those without images (imageId is null AND no images relation)
 * 3. Deletes these duplicate entries
 *
 * Usage:
 *   npx ts-node scripts/tools/remove_duplicate_sth_2025.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicateSTH() {
  console.log('=== Removing Duplicate STH Variants (2025 Mainline, No Images) ===\n');

  // Find all 2025 Mainline STH variants without images
  const duplicateVariants = await prisma.variant.findMany({
    where: {
      year: 2025,
      isSuperTreasureHunt: true,
      imageId: null,
      model: {
        collection: {
          name: 'Mainline',
          year: {
            year: 2025,
          },
        },
      },
      images: {
        none: {}, // No images relation
      },
    },
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
  });

  console.log(`Found ${duplicateVariants.length} duplicate STH variants without images.\n`);

  if (duplicateVariants.length === 0) {
    console.log('No duplicate variants found. Nothing to delete.');
    return;
  }

  // Show what will be deleted
  console.log('Variants to be deleted:');
  duplicateVariants.forEach((v, index) => {
    console.log(
      `  ${index + 1}. ID: ${v.id}, Model: ${v.model.castingName}, Card #: ${v.cardNumber}, Color: ${v.color || 'N/A'}`
    );
  });

  console.log(`\n⚠️  WARNING: About to delete ${duplicateVariants.length} variants.`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Delete the variants
  let deletedCount = 0;
  for (const variant of duplicateVariants) {
    try {
      await prisma.variant.delete({
        where: { id: variant.id },
      });
      deletedCount++;
      console.log(`✓ Deleted variant ID ${variant.id}: ${variant.model.castingName} (Card #: ${variant.cardNumber})`);
    } catch (error) {
      console.error(`✗ Error deleting variant ID ${variant.id}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total variants found: ${duplicateVariants.length}`);
  console.log(`Successfully deleted: ${deletedCount}`);
  console.log(`Failed: ${duplicateVariants.length - deletedCount}`);
  console.log('\n✅ Cleanup completed!');
}

removeDuplicateSTH()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










