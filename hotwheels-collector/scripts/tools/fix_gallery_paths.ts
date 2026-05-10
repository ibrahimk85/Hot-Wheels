/**
 * Script to fix Elite 64 Gallery image paths in database
 * 
 * This script:
 * 1. Finds all images in the elite64/gallery directory
 * 2. Checks database for existing records
 * 3. Updates or creates Image records with correct paths
 * 
 * Usage:
 *   npx ts-node scripts/tools/fix_gallery_paths.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fix Elite 64 Gallery Image Paths ===\n');

  // Gallery directory
  const galleryDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', 'elite64', 'gallery');
  
  if (!fs.existsSync(galleryDir)) {
    console.log(`Gallery directory not found: ${galleryDir}`);
    console.log('Please run the gallery download script first.');
    return;
  }

  // Get all image files in gallery directory
  const files = fs.readdirSync(galleryDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`Found ${files.length} image files in gallery directory\n`);

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const relativePath = `/images/hotwheels/elite64/gallery/${file}`;
    const fullPath = path.join(galleryDir, file);
    
    // Extract image name from filename (remove extension and convert to readable name)
    const nameWithoutExt = path.basename(file, path.extname(file));
    const imageName = nameWithoutExt
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Check if image record exists with this path
    let existingImage = await prisma.image.findFirst({
      where: {
        path: relativePath,
      },
    });

    // If not found, check for old path patterns
    if (!existingImage) {
      existingImage = await prisma.image.findFirst({
        where: {
          OR: [
            { path: { contains: `/gallery/elite64/${file}` } },
            { path: { contains: `/elite64/gallery/${file}` } },
            { path: { contains: file } },
          ],
        },
      });
    }

    if (existingImage) {
      // Update path if it's different
      if (existingImage.path !== relativePath) {
        await prisma.image.update({
          where: { id: existingImage.id },
          data: {
            path: relativePath,
            alt: imageName,
          },
        });
        updated++;
        console.log(`  ✓ Updated: ${file} → ${relativePath}`);
      } else {
        skipped++;
        console.log(`  - Already correct: ${file}`);
      }
    } else {
      // Create new image record
      try {
        await prisma.image.create({
          data: {
            path: relativePath,
            alt: imageName,
            // Don't link to model or variant - these are standalone gallery images
          },
        });
        created++;
        console.log(`  + Created: ${file} → ${relativePath}`);
      } catch (err: any) {
        if (err.code !== 'P2002') {
          console.error(`  ✗ Error creating record for ${file}:`, err);
        } else {
          skipped++;
          console.log(`  - Skipped (duplicate): ${file}`);
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Files found: ${files.length}`);
  console.log(`Records created: ${created}`);
  console.log(`Records updated: ${updated}`);
  console.log(`Records skipped: ${skipped}`);
  console.log('\nPath fix completed!');
}

main()
  .catch((err) => {
    console.error('Error fixing gallery paths:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

