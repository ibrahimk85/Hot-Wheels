/**
 * Script to clean up COL# 366+ image records from database
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up COL# 366+ image records...\n');

  // Find all COL# 366+ variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      cardNumber: { gte: '366' },
    },
    include: {
      images: true,
    },
  });

  console.log(`Found ${variants.length} COL# 366+ variants\n`);

  // Collect all image IDs to delete
  const imageIdsToDelete = new Set<number>();
  
  for (const variant of variants) {
    // Add variant's main imageId
    if (variant.imageId) {
      imageIdsToDelete.add(variant.imageId);
    }
    
    // Add all images linked to this variant
    for (const image of variant.images) {
      imageIdsToDelete.add(image.id);
    }
  }

  console.log(`Found ${imageIdsToDelete.size} image records to delete\n`);

  // First, remove imageId from variants
  let updatedVariants = 0;
  for (const variant of variants) {
    if (variant.imageId) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: null },
      });
      updatedVariants++;
    }
  }

  console.log(`✓ Removed imageId from ${updatedVariants} variants\n`);

  // Delete image records
  if (imageIdsToDelete.size > 0) {
    const deleted = await prisma.image.deleteMany({
      where: {
        id: { in: Array.from(imageIdsToDelete) },
      },
    });
    console.log(`✓ Deleted ${deleted.count} image records\n`);
  }

  console.log('✅ Cleanup complete! Ready to re-download images.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














