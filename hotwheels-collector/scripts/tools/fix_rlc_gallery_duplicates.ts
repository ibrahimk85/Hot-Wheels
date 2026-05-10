/**
 * Script to fix duplicate RLC gallery image names by adding year prefix
 * 
 * This script checks for RLC gallery images from 2024 and 2025 that might
 * have duplicate names, and renames them by adding the year prefix.
 * 
 * Usage:
 *   npx ts-node scripts/tools/fix_rlc_gallery_duplicates.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TARGET_YEARS = [2024, 2025];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('\n=== Fix RLC Gallery Duplicate Image Names ===\n');

  for (const year of TARGET_YEARS) {
    console.log(`\nProcessing year ${year}...`);
    
    const yearFolder = year.toString();
    const galleryDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'rlc', 'gallery');
    
    if (!fs.existsSync(galleryDir)) {
      console.log(`  Gallery directory not found: ${galleryDir}`);
      continue;
    }

    // Get all images from database for this year's RLC gallery
    const galleryImages = await prisma.image.findMany({
      where: {
        path: {
          contains: `/images/hotwheels/${yearFolder}/rlc/gallery/`,
        },
        isGalleryImage: true,
      },
    });

    console.log(`  Found ${galleryImages.length} gallery images in database`);

    let renamedCount = 0;
    let skippedCount = 0;

    for (const image of galleryImages) {
      const relativePath = image.path;
      const fileName = path.basename(relativePath);
      
      // Skip if already has year prefix
      if (fileName.startsWith(`${year}-`)) {
        skippedCount++;
        continue;
      }

      // Extract extension
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const baseName = fileName.replace(/\.([a-zA-Z0-9]+)$/, '');

      // Create new filename with year prefix
      const newFileName = `${year}-${baseName}.${ext}`;
      const oldFilePath = path.join(process.cwd(), 'public', relativePath);
      const newRelativePath = relativePath.replace(fileName, newFileName);
      const newFilePath = path.join(process.cwd(), 'public', newRelativePath);

      // Check if old file exists
      if (!fs.existsSync(oldFilePath)) {
        console.log(`  Warning: File not found: ${oldFilePath}`);
        continue;
      }

      // Check if new file already exists
      if (fs.existsSync(newFilePath)) {
        console.log(`  Skipping: ${newFileName} already exists`);
        skippedCount++;
        continue;
      }

      try {
        // Rename file
        await fs.promises.rename(oldFilePath, newFilePath);
        
        // Update database
        await prisma.image.update({
          where: { id: image.id },
          data: { path: newRelativePath },
        });

        renamedCount++;
        console.log(`  Renamed: ${fileName} → ${newFileName}`);
      } catch (error: any) {
        console.error(`  Error renaming ${fileName}:`, error.message);
      }
    }

    console.log(`  Year ${year} summary: ${renamedCount} renamed, ${skippedCount} skipped`);
  }

  console.log('\n=== Fix Complete ===\n');
}

main()
  .catch((err) => {
    console.error('Error during fix:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


