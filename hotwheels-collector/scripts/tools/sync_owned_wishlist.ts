/**
 * Sync owned and wishlist status between Model and Variant
 * 
 * This script ensures that:
 * 1. If a Model is owned/wishlisted, all its Variants are also owned/wishlisted
 * 2. If a Variant is owned/wishlisted, its Model is also owned/wishlisted
 * 
 * Run with: npm run sync:owned-wishlist
 * or: ts-node scripts/tools/sync_owned_wishlist.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function syncOwnedWishlist() {
  console.log('Starting owned/wishlist synchronization...\n');

  try {
    // Step 1: Sync from Model to Variants
    console.log('Step 1: Syncing Model -> Variants...');
    
    // Find all owned models
    const ownedModels = await prisma.model.findMany({
      where: { owned: true },
      select: { id: true },
    });
    
    console.log(`Found ${ownedModels.length} owned models`);
    
    // Update all variants of owned models to be owned
    for (const model of ownedModels) {
      const updated = await prisma.variant.updateMany({
        where: { modelId: model.id, owned: false },
        data: { owned: true },
      });
      if (updated.count > 0) {
        console.log(`  Model ${model.id}: Updated ${updated.count} variants to owned`);
      }
    }

    // Find all wishlisted models
    const wishlistedModels = await prisma.model.findMany({
      where: { wishlisted: true },
      select: { id: true },
    });
    
    console.log(`Found ${wishlistedModels.length} wishlisted models`);
    
    // Update all variants of wishlisted models to be wishlisted
    for (const model of wishlistedModels) {
      const updated = await prisma.variant.updateMany({
        where: { modelId: model.id, wishlisted: false },
        data: { wishlisted: true },
      });
      if (updated.count > 0) {
        console.log(`  Model ${model.id}: Updated ${updated.count} variants to wishlisted`);
      }
    }

    console.log('\nStep 2: Syncing Variants -> Models...');

    // Step 2: Sync from Variants to Models
    // Find all models that have at least one owned variant
    const modelsWithOwnedVariants = await prisma.variant.findMany({
      where: { owned: true },
      select: { modelId: true },
      distinct: ['modelId'],
    });

    console.log(`Found ${modelsWithOwnedVariants.length} models with owned variants`);

    // Update models to be owned if they have owned variants
    for (const variant of modelsWithOwnedVariants) {
      const model = await prisma.model.findUnique({
        where: { id: variant.modelId },
        select: { owned: true },
      });

      if (model && !model.owned) {
        await prisma.model.update({
          where: { id: variant.modelId },
          data: { owned: true },
        });
        console.log(`  Model ${variant.modelId}: Updated to owned`);
      }
    }

    // Find all models that have at least one wishlisted variant
    const modelsWithWishlistedVariants = await prisma.variant.findMany({
      where: { wishlisted: true },
      select: { modelId: true },
      distinct: ['modelId'],
    });

    console.log(`Found ${modelsWithWishlistedVariants.length} models with wishlisted variants`);

    // Update models to be wishlisted if they have wishlisted variants
    for (const variant of modelsWithWishlistedVariants) {
      const model = await prisma.model.findUnique({
        where: { id: variant.modelId },
        select: { wishlisted: true },
      });

      if (model && !model.wishlisted) {
        await prisma.model.update({
          where: { id: variant.modelId },
          data: { wishlisted: true },
        });
        console.log(`  Model ${variant.modelId}: Updated to wishlisted`);
      }
    }

    // Step 3: Clean up - if a model has no owned variants, set model.owned to false
    console.log('\nStep 3: Cleaning up models with no owned variants...');
    
    const allModels = await prisma.model.findMany({
      where: { owned: true },
      select: { id: true },
    });

    let cleanedModels = 0;
    for (const model of allModels) {
      const ownedVariantsCount = await prisma.variant.count({
        where: {
          modelId: model.id,
          owned: true,
        },
      });

      if (ownedVariantsCount === 0) {
        await prisma.model.update({
          where: { id: model.id },
          data: { owned: false },
        });
        cleanedModels++;
        console.log(`  Model ${model.id}: Set to not owned (no owned variants)`);
      }
    }

    // Clean up wishlisted models
    const allWishlistedModels = await prisma.model.findMany({
      where: { wishlisted: true },
      select: { id: true },
    });

    let cleanedWishlistedModels = 0;
    for (const model of allWishlistedModels) {
      const wishlistedVariantsCount = await prisma.variant.count({
        where: {
          modelId: model.id,
          wishlisted: true,
        },
      });

      if (wishlistedVariantsCount === 0) {
        await prisma.model.update({
          where: { id: model.id },
          data: { wishlisted: false },
        });
        cleanedWishlistedModels++;
        console.log(`  Model ${model.id}: Set to not wishlisted (no wishlisted variants)`);
      }
    }

    console.log(`\nCleaned up ${cleanedModels} owned models and ${cleanedWishlistedModels} wishlisted models`);

    // Final statistics
    const [finalOwnedModels, finalOwnedVariants, finalWishlistedModels, finalWishlistedVariants] = await Promise.all([
      prisma.model.count({ where: { owned: true } }),
      prisma.variant.count({ where: { owned: true } }),
      prisma.model.count({ where: { wishlisted: true } }),
      prisma.variant.count({ where: { wishlisted: true } }),
    ]);

    console.log('\n=== Final Statistics ===');
    console.log(`Owned Models: ${finalOwnedModels}`);
    console.log(`Owned Variants: ${finalOwnedVariants}`);
    console.log(`Wishlisted Models: ${finalWishlistedModels}`);
    console.log(`Wishlisted Variants: ${finalWishlistedVariants}`);

    console.log('\n✅ Synchronization completed successfully!');
  } catch (error) {
    console.error('❌ Error during synchronization:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

syncOwnedWishlist()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


