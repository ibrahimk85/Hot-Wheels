/**
 * Script to delete the 2023 Fast & Furious collection (NOT Premium).
 * 
 * This script:
 *   1. Finds the "Fast & Furious" collection for year 2023
 *   2. Deletes all related Images (database records and files)
 *   3. Deletes all Variants
 *   4. Deletes all Models
 *   5. Deletes all SubSeries
 *   6. Deletes the Collection itself
 *   7. Deletes image files from filesystem
 * 
 * WARNING: This operation is irreversible!
 * 
 * How to use:
 *   npx ts-node scripts/tools/delete_2023_fast_and_furious.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const targetYear = 2023;
const collectionName = 'Fast & Furious';

async function main() {
  console.log('=== DELETING 2023 FAST & FURIOUS COLLECTION ===');
  console.log(`Target Year: ${targetYear}`);
  console.log(`Collection Name: ${collectionName}`);
  console.log('');

  // Find the collection
  const yearRecord = await prisma.year.findFirst({
    where: { year: targetYear },
  });

  if (!yearRecord) {
    console.log(`Year ${targetYear} not found. Nothing to delete.`);
    return;
  }

  const collection = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      yearId: yearRecord.id,
    },
    include: {
      subSeries: {
        include: {
          models: {
            include: {
              variants: {
                include: {
                  images: true,
                },
              },
              images: true,
            },
          },
        },
      },
      models: {
        include: {
          variants: {
            include: {
              images: true,
            },
          },
          images: true,
        },
      },
    },
  });

  if (!collection) {
    console.log(`Collection "${collectionName}" for year ${targetYear} not found. Nothing to delete.`);
    return;
  }

  console.log(`Found collection: ${collection.name} (ID: ${collection.id})`);
  console.log(`SubSeries count: ${collection.subSeries.length}`);
  console.log(`Models count: ${collection.models.length}`);

  // Collect all image paths and IDs
  const imagePaths: string[] = [];
  const imageIds: number[] = [];

  // Collect images from variants
  for (const model of collection.models) {
    for (const variant of model.variants) {
      for (const image of variant.images) {
        imagePaths.push(image.path);
        imageIds.push(image.id);
      }
    }
    // Collect images from models
    for (const image of model.images) {
      imagePaths.push(image.path);
      imageIds.push(image.id);
    }
  }

  // Also check SubSeries models
  for (const subSeries of collection.subSeries) {
    for (const model of subSeries.models) {
      for (const variant of model.variants) {
        for (const image of variant.images) {
          imagePaths.push(image.path);
          imageIds.push(image.id);
        }
      }
      for (const image of model.images) {
        imagePaths.push(image.path);
        imageIds.push(image.id);
      }
    }
  }

  console.log(`Total images to delete: ${imageIds.length}`);
  console.log('');

  // Delete image files from filesystem
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'fast-and-furious');
  console.log(`Deleting image files from: ${baseDir}`);

  if (fs.existsSync(baseDir)) {
    // Delete entire directory
    fs.rmSync(baseDir, { recursive: true, force: true });
    console.log(`✓ Deleted directory: ${baseDir}`);
  } else {
    console.log(`Directory not found: ${baseDir}`);
  }

  // Delete individual image files (in case they're in different locations)
  for (const imagePath of imagePaths) {
    if (imagePath) {
      // Convert relative path to absolute
      const absolutePath = path.join(process.cwd(), 'public', imagePath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
          console.log(`✓ Deleted file: ${imagePath}`);
        } catch (error) {
          console.warn(`Failed to delete file ${imagePath}:`, error);
        }
      }
    }
  }

  console.log('');

  // Delete database records
  // Note: Images are deleted via cascade when variants/models are deleted
  // But we'll delete them explicitly to be safe

  // Delete images first
  if (imageIds.length > 0) {
    const deletedImages = await prisma.image.deleteMany({
      where: {
        id: { in: imageIds },
      },
    });
    console.log(`✓ Deleted ${deletedImages.count} image records`);
  }

  // Count variants before deletion
  let variantCount = 0;
  for (const model of collection.models) {
    variantCount += model.variants.length;
  }
  for (const subSeries of collection.subSeries) {
    for (const model of subSeries.models) {
      variantCount += model.variants.length;
    }
  }

  // Delete variants (cascade will delete related images)
  const deletedVariants = await prisma.variant.deleteMany({
    where: {
      model: {
        collectionId: collection.id,
      },
    },
  });
  console.log(`✓ Deleted ${deletedVariants.count} variant records`);

  // Delete models (cascade will delete related variants and images)
  const deletedModels = await prisma.model.deleteMany({
    where: {
      collectionId: collection.id,
    },
  });
  console.log(`✓ Deleted ${deletedModels.count} model records`);

  // Delete SubSeries
  const deletedSubSeries = await prisma.subSeries.deleteMany({
    where: {
      collectionId: collection.id,
    },
  });
  console.log(`✓ Deleted ${deletedSubSeries.count} subSeries records`);

  // Delete the collection itself
  await prisma.collection.delete({
    where: {
      id: collection.id,
    },
  });
  console.log(`✓ Deleted collection: ${collection.name}`);

  console.log('');
  console.log('=== DELETION COMPLETE ===');
  console.log(`Deleted ${deletedModels.count} models`);
  console.log(`Deleted ${deletedVariants.count} variants`);
  console.log(`Deleted ${imageIds.length} images`);
  console.log(`Deleted ${deletedSubSeries.count} subSeries`);
  console.log(`Deleted 1 collection`);
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
