/**
 * Script to fix duplicate 2010 Year and Mainline Collection records
 * 
 * Strategy:
 * 1. Move all models from old Collection (ID: 178, Year: 55) to new Collection (ID: 179, Year: 44)
 * 2. Delete old Collection (ID: 178)
 * 3. Delete old Year (ID: 55)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing 2010 Duplicates ===\n');

  const oldYearId = 55; // Year with notes: '2010 USA'
  const newYearId = 44; // Year with notes: null
  const oldCollectionId = 178; // Mainline collection in old Year
  const newCollectionId = 179; // Mainline collection in new Year

  // Check current state
  const oldYear = await prisma.year.findUnique({ where: { id: oldYearId } });
  const newYear = await prisma.year.findUnique({ where: { id: newYearId } });
  const oldCollection = await prisma.collection.findUnique({ 
    where: { id: oldCollectionId },
    include: { _count: { select: { models: true } } }
  });
  const newCollection = await prisma.collection.findUnique({ 
    where: { id: newCollectionId },
    include: { _count: { select: { models: true } } }
  });

  console.log('Current state:');
  console.log(`  Old Year (ID: ${oldYearId}): ${oldYear?.year}, Notes: ${oldYear?.notes || '(null)'}`);
  console.log(`  New Year (ID: ${newYearId}): ${newYear?.year}, Notes: ${newYear?.notes || '(null)'}`);
  console.log(`  Old Collection (ID: ${oldCollectionId}): ${oldCollection?.name}, Models: ${oldCollection?._count.models}`);
  console.log(`  New Collection (ID: ${newCollectionId}): ${newCollection?.name}, Models: ${newCollection?._count.models}\n`);

  if (!oldYear || !newYear || !oldCollection || !newCollection) {
    console.error('❌ Required records not found!');
    return;
  }

  // Check if old collection has models
  const oldModels = await prisma.model.findMany({
    where: { collectionId: oldCollectionId },
    include: {
      _count: { select: { variants: true } }
    }
  });

  console.log(`Found ${oldModels.length} models in old collection\n`);

  if (oldModels.length > 0) {
    console.log('Moving models to new collection...');
    
    // Check for duplicate models (same castingName in same SubSeries)
    let movedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    for (const model of oldModels) {
      // Find SubSeries in new collection with same name
      const oldSubSeries = model.subSeriesId 
        ? await prisma.subSeries.findUnique({ where: { id: model.subSeriesId } })
        : null;

      let newSubSeriesId: number | null = null;
      if (oldSubSeries) {
        const existingSubSeries = await prisma.subSeries.findFirst({
          where: {
            name: oldSubSeries.name,
            collectionId: newCollectionId,
          }
        });
        if (existingSubSeries) {
          newSubSeriesId = existingSubSeries.id;
        }
      }

      // Check if model already exists in new collection
      const existingModel = await prisma.model.findFirst({
        where: {
          castingName: model.castingName,
          collectionId: newCollectionId,
          subSeriesId: newSubSeriesId,
        }
      });

      if (existingModel) {
        // Model already exists - move variants to existing model
        console.log(`  Model "${model.castingName}" already exists, moving variants...`);
        
        const variants = await prisma.variant.findMany({
          where: { modelId: model.id }
        });

        for (const variant of variants) {
          // Check if variant already exists (by toyNumber and year)
          const existingVariant = await prisma.variant.findFirst({
            where: {
              modelId: existingModel.id,
              toyNumber: variant.toyNumber,
              year: variant.year,
            }
          });

          if (!existingVariant) {
            await prisma.variant.update({
              where: { id: variant.id },
              data: { modelId: existingModel.id }
            });
            movedCount++;
          } else {
            duplicateCount++;
            // Delete duplicate variant
            await prisma.variant.delete({ where: { id: variant.id } });
          }
        }

        // Delete old model
        await prisma.model.delete({ where: { id: model.id } });
        skippedCount++;
      } else {
        // Model doesn't exist - move it
        await prisma.model.update({
          where: { id: model.id },
          data: {
            collectionId: newCollectionId,
            subSeriesId: newSubSeriesId,
          }
        });
        movedCount++;
        console.log(`  Moved model: ${model.castingName}`);
      }
    }

    console.log(`\n✅ Moved ${movedCount} models/variants`);
    console.log(`   Skipped ${skippedCount} duplicate models`);
    console.log(`   Removed ${duplicateCount} duplicate variants`);
  }

  // Delete old collection (this will cascade delete SubSeries)
  console.log('\nDeleting old collection...');
  await prisma.collection.delete({
    where: { id: oldCollectionId }
  });
  console.log('✅ Old collection deleted');

  // Check if old Year has any other collections
  const remainingCollections = await prisma.collection.findMany({
    where: { yearId: oldYearId }
  });

  if (remainingCollections.length === 0) {
    console.log('\nDeleting old Year...');
    await prisma.year.delete({
      where: { id: oldYearId }
    });
    console.log('✅ Old Year deleted');
  } else {
    console.log(`\n⚠️  Old Year still has ${remainingCollections.length} collection(s), not deleting`);
  }

  // Final state
  const finalNewCollection = await prisma.collection.findUnique({ 
    where: { id: newCollectionId },
    include: { 
      _count: { select: { models: true } },
      subSeries: {
        include: {
          _count: { select: { models: true } }
        }
      }
    }
  });

  console.log('\n=== Final State ===');
  console.log(`New Collection (ID: ${newCollectionId}): ${finalNewCollection?.name}`);
  console.log(`  Models: ${finalNewCollection?._count.models}`);
  console.log(`  SubSeries:`);
  for (const subSeries of finalNewCollection?.subSeries || []) {
    console.log(`    - ${subSeries.name}: ${subSeries._count.models} models`);
  }

  console.log('\n✅ Fix completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
