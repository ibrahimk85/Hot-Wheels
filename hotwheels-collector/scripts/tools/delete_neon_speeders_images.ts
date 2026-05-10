/**
 * Script to delete all Image records for Neon Speeders 2023 variants
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
      images: true,
    },
  });

  console.log(`Found ${variants.length} variants for Neon Speeders ${year}`);

  let deletedCount = 0;
  let updatedCount = 0;

  for (const variant of variants) {
    // Delete all images for this variant
    if (variant.images.length > 0) {
      await prisma.image.deleteMany({
        where: {
          variantId: variant.id,
        },
      });
      deletedCount += variant.images.length;
    }

    // Clear imageId from variant if set
    if (variant.imageId !== null) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: null },
      });
      updatedCount++;
    }
  }

  console.log(`\nDeleted ${deletedCount} image records`);
  console.log(`Updated ${updatedCount} variants (cleared imageId)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
