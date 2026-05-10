/**
 * Fix Boulevard duplicate models
 * 
 * Strategy:
 * 1. Find all duplicate models (same castingName)
 * 2. Keep models that have subSeries AND images
 * 3. Delete models without subSeries
 * 4. For duplicates with subSeries, keep the one with images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const targetYear = 2023;

async function main() {
  console.log('=== BOULEVARD DUPLICATE FIX ===\n');

  // Get Boulevard collection
  const boulevardCollection = await prisma.collection.findFirst({
    where: {
      name: 'Boulevard',
      year: { year: targetYear },
    },
    include: {
      subSeries: true,
    },
  });

  if (!boulevardCollection) {
    console.error('Boulevard collection not found!');
    return;
  }

  // Get all Boulevard models
  const allModels = await prisma.model.findMany({
    where: {
      collectionId: boulevardCollection.id,
    },
    include: {
      subSeries: true,
      variants: {
        include: {
          images: true,
        },
      },
    },
  });

  console.log(`Total Boulevard models: ${allModels.length}\n`);

  // Group by castingName
  const byCastingName = new Map<string, typeof allModels>();
  
  for (const model of allModels) {
    const name = model.castingName;
    if (!byCastingName.has(name)) {
      byCastingName.set(name, []);
    }
    byCastingName.get(name)!.push(model);
  }

  // Find duplicates and models without subSeries
  const duplicates = Array.from(byCastingName.entries())
    .filter(([_, models]) => models.length > 1);

  const modelsWithoutSubSeries = allModels.filter(m => m.subSeriesId === null);

  console.log(`Duplicate casting names: ${duplicates.length}`);
  console.log(`Models without subSeries: ${modelsWithoutSubSeries.length}\n`);

  let deletedModels = 0;
  let deletedVariants = 0;
  let deletedImages = 0;

  // Delete models without subSeries
  if (modelsWithoutSubSeries.length > 0) {
    console.log('=== DELETING MODELS WITHOUT SUB-SERIES ===\n');
    
    for (const model of modelsWithoutSubSeries) {
      console.log(`Deleting Model ID ${model.id}: ${model.castingName} (no subSeries)`);
      
      // Count variants and images to delete
      const variantCount = model.variants.length;
      let imageCount = 0;
      for (const variant of model.variants) {
        imageCount += variant.images.length;
      }

      // Delete all variants (this will cascade delete images)
      for (const variant of model.variants) {
        // Delete variant images first
        await prisma.image.deleteMany({
          where: { variantId: variant.id },
        });
        deletedImages += variant.images.length;
      }

      // Delete all variants
      await prisma.variant.deleteMany({
        where: { modelId: model.id },
      });
      deletedVariants += variantCount;

      // Delete the model
      await prisma.model.delete({
        where: { id: model.id },
      });
      deletedModels++;
    }
  }

  // Handle duplicates - keep the one with subSeries and images
  if (duplicates.length > 0) {
    console.log('\n=== RESOLVING DUPLICATES ===\n');
    
    for (const [castingName, models] of duplicates) {
      // Sort: first by hasSubSeries, then by hasImages
      const sorted = models.sort((a, b) => {
        const aHasSubSeries = a.subSeriesId !== null ? 1 : 0;
        const bHasSubSeries = b.subSeriesId !== null ? 1 : 0;
        if (aHasSubSeries !== bHasSubSeries) {
          return bHasSubSeries - aHasSubSeries; // Has subSeries first
        }
        
        const aHasImages = a.variants.some(v => v.imageId !== null || v.images.length > 0) ? 1 : 0;
        const bHasImages = b.variants.some(v => v.imageId !== null || v.images.length > 0) ? 1 : 0;
        return bHasImages - aHasImages; // Has images first
      });

      const keepModel = sorted[0];
      const deleteModels = sorted.slice(1);

      console.log(`\n${castingName}:`);
      console.log(`  ✅ Keep: Model ID ${keepModel.id} (${keepModel.subSeries?.name || 'NO SUB-SERIES'})`);

      for (const model of deleteModels) {
        console.log(`  ❌ Delete: Model ID ${model.id} (${model.subSeries?.name || 'NO SUB-SERIES'})`);
        
        // Count to delete
        const variantCount = model.variants.length;
        let imageCount = 0;
        for (const variant of model.variants) {
          imageCount += variant.images.length;
        }

        // Delete variant images
        for (const variant of model.variants) {
          await prisma.image.deleteMany({
            where: { variantId: variant.id },
          });
          deletedImages += variant.images.length;
        }

        // Delete variants
        await prisma.variant.deleteMany({
          where: { modelId: model.id },
        });
        deletedVariants += variantCount;

        // Delete model
        await prisma.model.delete({
          where: { id: model.id },
        });
        deletedModels++;
      }
    }
  }

  // Final count
  const remainingModels = await prisma.model.count({
    where: {
      collectionId: boulevardCollection.id,
    },
  });

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Deleted models: ${deletedModels}`);
  console.log(`Deleted variants: ${deletedVariants}`);
  console.log(`Deleted images: ${deletedImages}`);
  console.log(`Remaining models: ${remainingModels}`);
  console.log(`Expected: 25 models`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





