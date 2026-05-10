/**
 * Test script to verify 2017 Mainline data and images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2017 Mainline data and images...\n');

  // Find 2017 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: { year: 2017 },
    },
  });

  if (!mainlineCollection) {
    console.log('✗ 2017 Mainline collection not found!');
    return;
  }

  // Get all variants
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2017,
      model: {
        collectionId: mainlineCollection.id,
      },
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

  console.log(`Total 2017 Mainline variants: ${allVariants.length}\n`);

  // Count by COL# range
  const mainVariants = allVariants.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col >= 1 && col <= 365;
  });
  
  const additionalVariants = allVariants.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col >= 366;
  });

  console.log(`Main Mainline (COL# 1-365): ${mainVariants.length} variants`);
  console.log(`Additional tables (COL# 366+): ${additionalVariants.length} variants\n`);

  // Check images
  let withImageId = 0;
  let withImageFile = 0;
  let missingImages = 0;

  for (const variant of allVariants) {
    if (variant.imageId) {
      withImageId++;
      const image = await prisma.image.findUnique({
        where: { id: variant.imageId },
      });
      if (image) {
        const filePath = path.join(process.cwd(), 'public', image.path);
        if (fs.existsSync(filePath)) {
          withImageFile++;
        } else {
          missingImages++;
        }
      }
    }
  }

  console.log('Image Status:');
  console.log(`  ✓ Variants with imageId: ${withImageId}`);
  console.log(`  ✓ Variants with image file: ${withImageFile}`);
  console.log(`  ✗ Missing image files: ${missingImages}\n`);

  // Check Toy# presence
  const withToyNumber = allVariants.filter(v => v.toyNumber).length;
  console.log(`Variants with Toy#: ${withToyNumber} / ${allVariants.length}\n`);

  // Check TH/STH flags
  const thVariants = allVariants.filter(v => v.isTreasureHunt).length;
  const sthVariants = allVariants.filter(v => v.isSuperTreasureHunt).length;
  console.log(`Treasure Hunt variants: ${thVariants}`);
  console.log(`Super Treasure Hunt variants: ${sthVariants}\n`);

  // List sub-series
  const subSeries = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
    include: {
      _count: { select: { models: true } },
    },
  });

  console.log(`SubSeries count: ${subSeries.length}`);
  console.log('\nSubSeries list:');
  subSeries.forEach(sub => {
    console.log(`  - ${sub.name}: ${sub._count.models} models`);
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














