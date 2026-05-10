/**
 * Script to verify Neon Speeders 2023 variant images in database and filesystem
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const year = 2023;
  const targetCardNumbers = ['JKX93', 'JKX94', 'JKX95', 'JKX96', 'JKX97', 'JKX98', 'JKX99', 'JKY00'];

  console.log(`Checking Neon Speeders ${year} images...\n`);

  for (const cardNumber of targetCardNumbers) {
    const variant = await prisma.variant.findFirst({
      where: {
        cardNumber: cardNumber,
        year: year,
        model: {
          collection: {
            name: 'Neon Speeders',
            year: {
              year: year,
            },
          },
        },
      },
      include: {
        images: {
          orderBy: {
            order: 'asc',
          },
        },
        model: true,
      },
    });

    if (!variant) {
      console.log(`❌ Variant not found: ${cardNumber}`);
      continue;
    }

    console.log(`\n${cardNumber} - ${variant.model.castingName}:`);
    console.log(`  Variant ID: ${variant.id}`);
    console.log(`  imageId: ${variant.imageId || 'NULL'}`);
    console.log(`  Images count: ${variant.images.length}`);

    // Check each image
    for (const img of variant.images) {
      const filePath = path.join(process.cwd(), 'public', img.path);
      const exists = fs.existsSync(filePath);
      const status = exists ? '✓' : '✗';
      console.log(`    ${status} ${img.notes} (order: ${img.order}, id: ${img.id})`);
      console.log(`      Path in DB: ${img.path}`);
      console.log(`      File path: ${filePath}`);
      console.log(`      File exists: ${exists}`);
    }

    // Check if imageId matches an image
    if (variant.imageId) {
      const mainImage = variant.images.find(img => img.id === variant.imageId);
      if (mainImage) {
        console.log(`  ✓ Main image (imageId) matches: ${mainImage.notes}`);
      } else {
        console.log(`  ✗ Main image (imageId: ${variant.imageId}) not found in variant.images array!`);
      }
    } else {
      console.log(`  ⚠ No main image (imageId is NULL)`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
