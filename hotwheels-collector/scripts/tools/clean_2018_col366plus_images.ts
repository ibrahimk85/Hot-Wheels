/**
 * Script to clean up incorrectly organized COL# 366+ images.
 * Deletes images organized by subSeriesSlug and prepares for re-download with correct folder structure (model name).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up COL# 366+ images organized by subSeries...\n');

  // Find all COL# 366+ variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      cardNumber: { gte: '366' },
    },
    include: {
      images: true,
      model: {
        include: {
          subSeries: true,
        },
      },
    },
  });

  console.log(`Found ${variants.length} COL# 366+ variants\n`);

  // Collect all image paths that need to be deleted
  const imagePathsToDelete = new Set<string>();
  const imageRecordsToUpdate: Array<{ id: number; path: string }> = [];

  for (const variant of variants) {
    for (const image of variant.images) {
      // Check if image path uses subSeriesSlug format (incorrect)
      // Correct format: /images/hotwheels/2018/mainline/{castingSlug}/{toyNumber}.jpg
      // Incorrect format: /images/hotwheels/2018/mainline/{subSeriesSlug}/{toyNumber}.jpg
      const pathParts = image.path.split('/');
      const folderName = pathParts[pathParts.length - 2]; // Second to last is folder name
      
      // Check if this looks like a subSeries slug (treasure-hunt, super-treasure-hunt, etc.)
      // vs a model name slug (usually longer and more descriptive)
      const isSubSeriesSlug = /^(treasure-hunt|super-treasure-hunt|hw-art-cars|kmart-exclusives|kroger-exclusives|target-red-editions|toys-r-us-exclusive|walmart-exclusive-zamac|walgreens-exclusive|daredevil-chase-variants|hw-50th-race-team-super-ultimate-chase)/i.test(folderName);
      
      if (isSubSeriesSlug) {
        imagePathsToDelete.add(path.join(process.cwd(), 'public', image.path));
        imageRecordsToUpdate.push({ id: image.id, path: image.path });
      }
    }
  }

  console.log(`Found ${imagePathsToDelete.size} image files to delete`);
  console.log(`Found ${imageRecordsToUpdate.length} image records that may need path updates\n`);

  // Delete image files
  let deletedFiles = 0;
  for (const filePath of imagePathsToDelete) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedFiles++;
      }
    } catch (err) {
      console.error(`Error deleting ${filePath}:`, err);
    }
  }

  console.log(`✓ Deleted ${deletedFiles} image files\n`);

  // Delete image records (they will be recreated with correct paths)
  let deletedRecords = 0;
  for (const imageRecord of imageRecordsToUpdate) {
    try {
      // First, remove imageId from variants that reference this image
      await prisma.variant.updateMany({
        where: { imageId: imageRecord.id },
        data: { imageId: null },
      });

      // Then delete the image record
      await prisma.image.delete({
        where: { id: imageRecord.id },
      });
      deletedRecords++;
    } catch (err) {
      console.error(`Error deleting image record ${imageRecord.id}:`, err);
    }
  }

  console.log(`✓ Deleted ${deletedRecords} image records\n`);

  // Also delete empty subSeries slug folders
  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'mainline');
  if (fs.existsSync(baseDir)) {
    const subSeriesSlugs = [
      'treasure-hunt',
      'super-treasure-hunt',
      'hw-art-cars',
      'kmart-exclusives',
      'kroger-exclusives',
      'target-red-editions',
      'toys-r-us-exclusive',
      'walmart-exclusive-zamac',
      'walgreens-exclusive',
      'daredevil-chase-variants',
      'hw-50th-race-team-super-ultimate-chase',
    ];

    let deletedFolders = 0;
    for (const slug of subSeriesSlugs) {
      const folderPath = path.join(baseDir, slug);
      if (fs.existsSync(folderPath)) {
        try {
          const files = fs.readdirSync(folderPath);
          if (files.length === 0) {
            fs.rmdirSync(folderPath);
            deletedFolders++;
            console.log(`✓ Deleted empty folder: ${slug}`);
          } else {
            // Try to remove all files first
            for (const file of files) {
              fs.unlinkSync(path.join(folderPath, file));
            }
            fs.rmdirSync(folderPath);
            deletedFolders++;
            console.log(`✓ Deleted folder with files: ${slug}`);
          }
        } catch (err) {
          console.error(`Error deleting folder ${slug}:`, err);
        }
      }
    }
    console.log(`\n✓ Deleted ${deletedFolders} subSeries slug folders\n`);
  }

  console.log('✅ Cleanup complete! Ready to re-download images with correct folder structure.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














