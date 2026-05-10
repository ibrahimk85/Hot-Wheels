/**
 * Test script to verify 2015 Mainline data and images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2013 Mainline data and images...\n');

  // Find 2013 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2013,
      },
    },
  });

  if (!mainlineCollection) {
    console.error('2013 Mainline collection not found!');
    return;
  }

  // Get all variants for 2013 Mainline
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2013,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: {
        include: {
          subSeries: true,
        },
      },
    },
  });

  console.log(`Total 2013 Mainline variants: ${allVariants.length}\n`);

  // Check main mainline (COL# 1-250 estimated) vs additional tables
  const mainlineVariants = allVariants.filter(v => {
    const colNum = v.cardNumber ? parseInt(v.cardNumber, 10) : 0;
    return colNum >= 1 && colNum <= 250;
  });
  const additionalVariants = allVariants.filter(v => {
    const colNum = v.cardNumber ? parseInt(v.cardNumber, 10) : 0;
    return colNum > 250;
  });

  console.log(`Main Mainline (COL# 1-250 estimated): ${mainlineVariants.length} variants`);
  console.log(`Additional tables (COL# >250): ${additionalVariants.length} variants`);

  const maxCol = allVariants.reduce((max, v) => {
    const colNum = v.cardNumber ? parseInt(v.cardNumber, 10) : 0;
    return colNum > max ? colNum : max;
  }, 0);
  console.log(`Max COL# found: ${maxCol}\n`);

  // Check images
  let withImageId = 0;
  let withImageFile = 0;
  const missingImages: typeof allVariants = [];

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
          missingImages.push(variant);
        }
      }
    }
  }

  console.log(`Image Status:`);
  console.log(`  ✓ Variants with imageId: ${withImageId}`);
  console.log(`  ✓ Variants with image file: ${withImageFile}`);
  console.log(`  ✗ Missing image files: ${missingImages.length}`);

  if (missingImages.length > 0 && missingImages.length <= 10) {
    console.log(`  Missing image examples:`);
    for (const v of missingImages.slice(0, 5)) {
      const model = await prisma.model.findUnique({ where: { id: v.modelId } });
      console.log(`    - ${model?.castingName || 'Unknown'} (Toy#: ${v.toyNumber}, COL#: ${v.cardNumber})`);
    }
  }
  console.log('');

  // Check Toy# presence
  const withToyNumber = allVariants.filter(v => v.toyNumber).length;
  console.log(`Toy# Status (CRITICAL for 2013):`);
  console.log(`  ✓ Variants with Toy#: ${withToyNumber} / ${allVariants.length}`);
  console.log(`  ✗ Variants without Toy#: ${allVariants.length - withToyNumber} / ${allVariants.length}\n`);

  // Check for COL# with multiple Toy# (expected for 2nd/3rd color)
  const colNumToToyNumbers = new Map<string, string[]>();
  for (const variant of allVariants) {
    if (variant.cardNumber && variant.toyNumber) {
      if (!colNumToToyNumbers.has(variant.cardNumber)) {
        colNumToToyNumbers.set(variant.cardNumber, []);
      }
      colNumToToyNumbers.get(variant.cardNumber)?.push(variant.toyNumber);
    }
  }

  let colWithMultipleToyNumbers = 0;
  const examples: string[] = [];
  colNumToToyNumbers.forEach((toyNumbers, colNum) => {
    if (toyNumbers.length > 1) {
      colWithMultipleToyNumbers++;
      if (examples.length < 5) { // Limit examples
        examples.push(`COL# ${colNum}: ${toyNumbers.join(', ')}`);
      }
    }
  });
  console.log(`COL# with multiple Toy# (expected for 2nd/3rd color): ${colWithMultipleToyNumbers}`);
  if (examples.length > 0) {
    console.log(`  Examples:`);
    examples.forEach(ex => console.log(`    ${ex}`));
  }
  console.log('\n');

  // Check TH/STH
  const thVariants = allVariants.filter(v => v.isTreasureHunt);
  const sthVariants = allVariants.filter(v => v.isSuperTreasureHunt);
  console.log(`Treasure Hunt variants: ${thVariants.length}`);
  console.log(`Super Treasure Hunt variants: ${sthVariants.length}\n`);

  // Check SubSeries
  const subSeries = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
    include: {
      _count: { select: { models: true } },
    },
  });

  console.log(`SubSeries count: ${subSeries.length}\n`);
  if (subSeries.length > 0 && subSeries.length <= 20) {
    console.log(`SubSeries list:`);
    subSeries.forEach(sub => {
      console.log(`  - ${sub.name}: ${sub._count.models} models`);
    });
  } else if (subSeries.length > 20) {
    console.log(`SubSeries list (first 20):`);
    subSeries.slice(0, 20).forEach(sub => {
      console.log(`  - ${sub.name}: ${sub._count.models} models`);
    });
    console.log(`  ... and ${subSeries.length - 20} more`);
  }
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

