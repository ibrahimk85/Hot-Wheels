/**
 * Script to clean up 2019 Fast & Furious Premium images and database records.
 * 
 * This script:
 *   1. Deletes all image files in public/images/hotwheels/2019/fast-furious-premium/
 *   2. Deletes all Image records from database for 2019 Fast & Furious Premium variants
 *   3. Removes imageId references from variants
 * 
 * How to use:
 *   npx ts-node scripts/tools/cleanup_2019_fast_furious_premium_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const targetYear = 2019;
const collectionName = 'Fast & Furious Premium';

async function main() {
  console.log('=== CLEANUP 2019 FAST & FURIOUS PREMIUM IMAGES ===');
  
  // Find all variants for 2019 Fast & Furious Premium
  const collection = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      year: { year: targetYear },
    },
    include: {
      year: true,
    },
  });

  if (!collection) {
    console.log(`Collection "${collectionName}" for year ${targetYear} not found. Nothing to clean up.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found collection: ${collectionName} (ID: ${collection.id})`);

  // Find all variants for this collection
  const variants = await prisma.variant.findMany({
    where: {
      model: {
        collectionId: collection.id,
      },
      year: targetYear,
    },
    include: {
      model: true,
    },
  });

  console.log(`Found ${variants.length} variants`);

  // Get all image IDs to delete
  const imageIds = new Set<number>();
  
  for (const variant of variants) {
    if (variant.imageId) {
      imageIds.add(variant.imageId);
    }
    
    // Get all images for this variant
    const images = await prisma.image.findMany({
      where: { variantId: variant.id },
    });
    
    for (const image of images) {
      imageIds.add(image.id);
    }
  }

  console.log(`Found ${imageIds.size} image records to delete`);

  // Delete image files - always use hotwheels-collector/public
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', targetYear.toString(), 'fast-furious-premium');
  
  let deletedFiles = 0;
  
  // Delete from the standard location
  if (fs.existsSync(baseDir)) {
    console.log(`Deleting files from: ${baseDir}`);
    try {
      // Recursively delete all files
      function deleteRecursive(dirPath: string) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            deleteRecursive(fullPath);
            // Delete directory if empty
            try {
              fs.rmdirSync(fullPath);
              console.log(`Deleted directory: ${fullPath}`);
            } catch (err) {
              // Directory not empty, skip
            }
          } else if (entry.isFile() && (entry.name.endsWith('.jpg') || entry.name.endsWith('.png') || entry.name.endsWith('.jpeg'))) {
            try {
              fs.unlinkSync(fullPath);
              deletedFiles++;
              console.log(`Deleted file: ${fullPath}`);
            } catch (err) {
              console.error(`Error deleting file ${fullPath}:`, err);
            }
          }
        }
      }
      
      deleteRecursive(baseDir);
      
      // Try to delete base directory if empty
      try {
        const contents = fs.readdirSync(baseDir);
        if (contents.length === 0) {
          fs.rmdirSync(baseDir);
          console.log(`Deleted base directory: ${baseDir}`);
        }
      } catch (err) {
        // Directory not empty, skip
      }
    } catch (err) {
      console.error(`Error processing directory ${baseDir}:`, err);
    }
  } else {
    console.log(`Directory does not exist: ${baseDir}`);
  }

  console.log(`Deleted ${deletedFiles} image files`);

  // Remove imageId from variants
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

  console.log(`Removed imageId from ${updatedVariants} variants`);

  // Delete Image records
  let deletedImages = 0;
  for (const imageId of imageIds) {
    try {
      await prisma.image.delete({
        where: { id: imageId },
      });
      deletedImages++;
    } catch (err) {
      console.error(`Error deleting image record ${imageId}:`, err);
    }
  }

  console.log(`Deleted ${deletedImages} image records from database`);
  console.log('\nCleanup complete!');
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

