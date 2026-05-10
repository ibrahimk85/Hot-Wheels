/**
 * Script to clean all 2021 Mainline data before re-importing
 * This will delete all variants, models, subSeries, and images for 2021 Mainline
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean2021Mainline() {
  console.log('=== Cleaning 2021 Mainline Data ===\n');

  // Get 2021 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2021,
      },
    },
  });

  if (!mainlineCollection) {
    console.log('No 2021 Mainline collection found. Nothing to clean.');
    return;
  }

  // Get all models for this collection
  const models = await prisma.model.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
    include: {
      variants: {
        include: {
          images: true,
        },
      },
    },
  });

  console.log(`Found ${models.length} models to clean\n`);

  let variantCount = 0;
  let imageCount = 0;

  // Delete all images associated with variants
  for (const model of models) {
    for (const variant of model.variants) {
      imageCount += variant.images.length;
      await prisma.image.deleteMany({
        where: {
          variantId: variant.id,
        },
      });
    }
    variantCount += model.variants.length;
  }

  // Delete all variants
  await prisma.variant.deleteMany({
    where: {
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  // Delete all models
  await prisma.model.deleteMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });

  // Delete all subSeries (they will be recreated during import)
  await prisma.subSeries.deleteMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });

  console.log(`Deleted:`);
  console.log(`  - ${models.length} models`);
  console.log(`  - ${variantCount} variants`);
  console.log(`  - ${imageCount} images`);
  console.log(`\n✅ 2021 Mainline data cleaned successfully!`);
  console.log(`\nYou can now run the import script to re-import all data.`);
}

clean2021Mainline()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















