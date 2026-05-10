/**
 * Script to delete ALL 2023 Neon Speeders data (variants, models, subSeries, collection, images)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const year = 2023;

  console.log(`Deleting all 2023 Neon Speeders data...\n`);

  // Find Neon Speeders collection for 2023
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Neon Speeders',
      year: {
        year: year,
      },
    },
    include: {
      models: {
        include: {
          variants: {
            include: {
              images: true,
            },
          },
          images: true,
        },
      },
    },
  });

  if (!collection) {
    console.log('Neon Speeders 2023 collection not found. Nothing to delete.');
    return;
  }

  console.log(`Found collection: ${collection.name} (ID: ${collection.id})`);
  console.log(`  Models: ${collection.models.length}`);
  
  let totalVariants = 0;
  let totalVariantImages = 0;
  let totalModelImages = 0;

  for (const model of collection.models) {
    totalVariants += model.variants.length;
    for (const variant of model.variants) {
      totalVariantImages += variant.images.length;
    }
    totalModelImages += model.images.length;
  }

  console.log(`  Total variants: ${totalVariants}`);
  console.log(`  Total variant images: ${totalVariantImages}`);
  console.log(`  Total model images: ${totalModelImages}\n`);

  // Delete all images (both variant and model images)
  console.log('Deleting images...');
  for (const model of collection.models) {
    // Delete variant images
    for (const variant of model.variants) {
      if (variant.images.length > 0) {
        await prisma.image.deleteMany({
          where: {
            variantId: variant.id,
          },
        });
        console.log(`  Deleted ${variant.images.length} images for variant ${variant.id}`);
      }
    }
    // Delete model images
    if (model.images.length > 0) {
      await prisma.image.deleteMany({
        where: {
          modelId: model.id,
        },
      });
      console.log(`  Deleted ${model.images.length} images for model ${model.id}`);
    }
  }

  // Delete all variants (CASCADE will handle images, but we already deleted them)
  console.log('\nDeleting variants...');
  const variantsDeleted = await prisma.variant.deleteMany({
    where: {
      model: {
        collectionId: collection.id,
      },
    },
  });
  console.log(`  Deleted ${variantsDeleted.count} variants`);

  // Delete all models
  console.log('\nDeleting models...');
  const modelsDeleted = await prisma.model.deleteMany({
    where: {
      collectionId: collection.id,
    },
  });
  console.log(`  Deleted ${modelsDeleted.count} models`);

  // Delete all subSeries
  console.log('\nDeleting subSeries...');
  const subSeriesDeleted = await prisma.subSeries.deleteMany({
    where: {
      collectionId: collection.id,
    },
  });
  console.log(`  Deleted ${subSeriesDeleted.count} subSeries`);

  // Delete the collection
  console.log('\nDeleting collection...');
  await prisma.collection.delete({
    where: {
      id: collection.id,
    },
  });
  console.log(`  Deleted collection ${collection.id}`);

  // Delete image files from filesystem
  console.log('\nDeleting image files from filesystem...');
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', year.toString(), 'neon-speeders');
  if (fs.existsSync(imageDir)) {
    fs.rmSync(imageDir, { recursive: true, force: true });
    console.log(`  Deleted directory: ${imageDir}`);
  } else {
    console.log(`  Directory does not exist: ${imageDir}`);
  }

  console.log('\n✅ All 2023 Neon Speeders data and images deleted successfully!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
