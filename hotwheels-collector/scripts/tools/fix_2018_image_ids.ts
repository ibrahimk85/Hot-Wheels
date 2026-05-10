/**
 * Script to fix missing imageId for COL# 366+ variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing missing imageId for COL# 366+ variants...\n');

  // Get all COL# 366+ variants
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

  let fixed = 0;
  let skipped = 0;

  for (const variant of variants) {
    // Skip if already has imageId
    if (variant.imageId) {
      // Verify the image file exists
      const image = await prisma.image.findUnique({
        where: { id: variant.imageId },
      });
      if (image) {
        const filePath = path.join(process.cwd(), 'public', image.path);
        if (fs.existsSync(filePath)) {
          skipped++;
          continue;
        }
      }
    }

    // Find image record for this variant
    if (variant.images && variant.images.length > 0) {
      // Use the first image
      const image = variant.images[0];
      
      // Verify file exists
      const filePath = path.join(process.cwd(), 'public', image.path);
      if (fs.existsSync(filePath)) {
        // Update variant with imageId
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: image.id },
        });
        fixed++;
        console.log(`✓ Fixed: ${variant.model.castingName} (COL#: ${variant.cardNumber}, Toy#: ${variant.toyNumber})`);
      } else {
        console.warn(`⚠️  Image file missing: ${variant.model.castingName} (COL#: ${variant.cardNumber}) - ${image.path}`);
      }
    } else {
      console.warn(`⚠️  No image records found: ${variant.model.castingName} (COL#: ${variant.cardNumber}, Toy#: ${variant.toyNumber})`);
    }
  }

  console.log(`\n✅ Fixed: ${fixed}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














