/**
 * Test script to verify 2016 Mainline data and images
 * IMPORTANT: 2016'da 2nd/3rd color varyantları aynı COL# ama farklı Toy#
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2016 Mainline data and images...\n');

  // Find 2016 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: { year: 2016 },
    },
  });

  if (!mainlineCollection) {
    console.log('✗ 2016 Mainline collection not found!');
    return;
  }

  // Get all variants
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2016,
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

  console.log(`Total 2016 Mainline variants: ${allVariants.length}\n`);

  // Find max COL# to determine main vs additional range
  const numericCols = allVariants
    .map(v => parseInt(v.cardNumber || '0'))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => b - a);
  
  const maxCol = numericCols.length > 0 ? numericCols[0] : 0;
  
  // Count by COL# range (assuming main mainline ends at a reasonable number, check actual data)
  // For now, we'll show distribution
  const mainVariants = allVariants.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col >= 1 && col <= 250; // Adjust based on actual data
  });
  
  const additionalVariants = allVariants.filter(v => {
    const col = parseInt(v.cardNumber || '0');
    return !isNaN(col) && col > 250;
  });

  console.log(`Main Mainline (COL# 1-250 estimated): ${mainVariants.length} variants`);
  console.log(`Additional tables (COL# >250): ${additionalVariants.length} variants`);
  console.log(`Max COL# found: ${maxCol}\n`);

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

  // Check Toy# presence - CRITICAL for 2016
  const withToyNumber = allVariants.filter(v => v.toyNumber).length;
  const withoutToyNumber = allVariants.filter(v => !v.toyNumber).length;
  console.log(`Toy# Status (CRITICAL for 2016):`);
  console.log(`  ✓ Variants with Toy#: ${withToyNumber} / ${allVariants.length}`);
  console.log(`  ✗ Variants without Toy#: ${withoutToyNumber} / ${allVariants.length}\n`);
  
  // Check for duplicate COL# with different Toy# (this is expected in 2016 for 2nd/3rd color)
  const colToToyMap = new Map<string, Set<string>>();
  for (const variant of allVariants) {
    if (variant.cardNumber && variant.toyNumber) {
      if (!colToToyMap.has(variant.cardNumber)) {
        colToToyMap.set(variant.cardNumber, new Set());
      }
      colToToyMap.get(variant.cardNumber)!.add(variant.toyNumber);
    }
  }
  
  const duplicateCols = Array.from(colToToyMap.entries())
    .filter(([_, toySet]) => toySet.size > 1);
  
  console.log(`COL# with multiple Toy# (expected for 2nd/3rd color): ${duplicateCols.length}`);
  if (duplicateCols.length > 0 && duplicateCols.length <= 10) {
    console.log('  Examples:');
    duplicateCols.slice(0, 5).forEach(([col, toySet]) => {
      console.log(`    COL# ${col}: ${Array.from(toySet).join(', ')}`);
    });
  }
  console.log('');

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
  if (subSeries.length > 0 && subSeries.length <= 20) {
    console.log('\nSubSeries list:');
    subSeries.forEach(sub => {
      console.log(`  - ${sub.name}: ${sub._count.models} models`);
    });
  } else if (subSeries.length > 20) {
    console.log('\nSubSeries list (first 20):');
    subSeries.slice(0, 20).forEach(sub => {
      console.log(`  - ${sub.name}: ${sub._count.models} models`);
    });
    console.log(`  ... and ${subSeries.length - 20} more`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














