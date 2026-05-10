/**
 * Script to check Neon Speeders 2023 variant images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const year = 2023;

  // Find all variants for Neon Speeders 2023
  const variants = await prisma.variant.findMany({
    where: {
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

  console.log(`Found ${variants.length} variants for Neon Speeders ${year}\n`);

  // Check the 8 variants we downloaded images for (JKX93-JKY00)
  const targetCardNumbers = ['JKX93', 'JKX94', 'JKX95', 'JKX96', 'JKX97', 'JKX98', 'JKX99', 'JKY00'];
  
  for (const cardNumber of targetCardNumbers) {
    const variant = variants.find(v => v.cardNumber === cardNumber);
    if (variant) {
      console.log(`\n${cardNumber} - ${variant.model.castingName}:`);
      console.log(`  imageId: ${variant.imageId || 'NULL'}`);
      console.log(`  Images (${variant.images.length}):`);
      variant.images.forEach(img => {
        console.log(`    - ${img.notes} (order: ${img.order}, path: ${img.path})`);
      });
    }
  }

  // Summary
  const variantsWithImages = variants.filter(v => v.images.length > 0);
  const variantsWithMainImage = variants.filter(v => v.imageId !== null);
  
  console.log(`\n\n=== Summary ===`);
  console.log(`Total variants: ${variants.length}`);
  console.log(`Variants with images: ${variantsWithImages.length}`);
  console.log(`Variants with main image (imageId): ${variantsWithMainImage.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
