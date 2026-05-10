/**
 * Script to completely delete Elite 64 collection
 * 
 * This script:
 * 1. Finds all Elite 64 collections (all years including Future)
 * 2. Deletes all related models, variants, and images from database
 * 3. Deletes physical image files from public/images/hotwheels/{year}/elite64/
 * 
 * WARNING: This is a destructive operation. Make sure you have a backup!
 * 
 * Usage:
 *   npx ts-node scripts/tools/delete_elite64.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Elite 64 Collection Deletion Script ===\n');
  console.log('WARNING: This will delete ALL Elite 64 data and images!\n');

  // Find all Elite 64 collections
  const elite64Collections = await prisma.collection.findMany({
    where: {
      name: 'Elite 64',
    },
    include: {
      year: true,
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

  if (elite64Collections.length === 0) {
    console.log('No Elite 64 collections found. Nothing to delete.');
    return;
  }

  console.log(`Found ${elite64Collections.length} Elite 64 collection(s):`);
  elite64Collections.forEach(col => {
    console.log(`  - ${col.name} (Year: ${col.year.year}, ID: ${col.id})`);
  });

  let totalModelsDeleted = 0;
  let totalVariantsDeleted = 0;
  let totalImagesDeleted = 0;
  let totalFilesDeleted = 0;
  const deletedPaths = new Set<string>();

  // Process each collection
  for (const collection of elite64Collections) {
    console.log(`\nProcessing collection: ${collection.name} (Year: ${collection.year.year})`);

    // Get all images for this collection (from models and variants)
    const allImages: Array<{ id: number; path: string }> = [];

    for (const model of collection.models) {
      // Add model images
      if (model.images && model.images.length > 0) {
        allImages.push(...model.images.map(img => ({ id: img.id, path: img.path })));
      }

      // Add variant images
      for (const variant of model.variants) {
        if (variant.images && variant.images.length > 0) {
          allImages.push(...variant.images.map(img => ({ id: img.id, path: img.path })));
        }
      }
    }

    console.log(`  Found ${collection.models.length} models, ${allImages.length} images`);

    // Delete physical image files
    for (const image of allImages) {
      if (image.path && !deletedPaths.has(image.path)) {
        const publicPath = path.join(process.cwd(), 'public', image.path);
        if (fs.existsSync(publicPath)) {
          try {
            fs.unlinkSync(publicPath);
            deletedPaths.add(image.path);
            totalFilesDeleted++;
            console.log(`    Deleted file: ${image.path}`);
          } catch (err: any) {
            console.error(`    Error deleting file ${image.path}:`, err.message);
          }
        }
      }
    }

    // Delete empty directories
    const yearFolder = collection.year.year === 9999 ? 'future' : collection.year.year.toString();
    const elite64Dir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'elite64');
    
    if (fs.existsSync(elite64Dir)) {
      try {
        // Try to remove the entire elite64 directory and its subdirectories
        const removeDir = (dir: string) => {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);
              if (stat.isDirectory()) {
                removeDir(filePath);
              } else {
                fs.unlinkSync(filePath);
              }
            });
            fs.rmdirSync(dir);
          }
        };
        removeDir(elite64Dir);
        console.log(`    Removed directory: ${elite64Dir}`);
      } catch (err: any) {
        console.warn(`    Could not remove directory ${elite64Dir}:`, err.message);
      }
    }

    // Count models and variants before deletion
    totalModelsDeleted += collection.models.length;
    for (const model of collection.models) {
      totalVariantsDeleted += model.variants.length;
      totalImagesDeleted += (model.images?.length || 0) + 
                           model.variants.reduce((sum, v) => sum + (v.images?.length || 0), 0);
    }
  }

  // Delete related records that don't have CASCADE
  console.log('\nDeleting related records...');
  
  // Get collection IDs and collect all related IDs first
  const collectionIds = elite64Collections.map(c => c.id);
  const modelIds: number[] = [];
  const variantIds: number[] = [];
  
  for (const collection of elite64Collections) {
    for (const model of collection.models) {
      modelIds.push(model.id);
      for (const variant of model.variants) {
        variantIds.push(variant.id);
      }
    }
  }
  
  // Get all subSeries IDs for these collections
  const allSubSeries = await prisma.subSeries.findMany({
    where: { collectionId: { in: collectionIds } },
    select: { id: true },
  });
  const subSeriesIds = allSubSeries.map(ss => ss.id);
  
  // Delete PriceAlert records (references Model and Variant without CASCADE)
  const priceAlertDelete = await prisma.priceAlert.deleteMany({
    where: {
      OR: [
        { modelId: { in: modelIds } },
        { variantId: { in: variantIds } },
      ],
    },
  });
  console.log(`  Deleted ${priceAlertDelete.count} PriceAlert records`);
  
  // Delete ReleaseDate records (can reference Collection, SubSeries, or Model)
  const releaseDateDelete = await prisma.releaseDate.deleteMany({
    where: {
      OR: [
        { collectionId: { in: collectionIds } },
        { subSeriesId: { in: subSeriesIds } },
        { modelId: { in: modelIds } },
      ],
    },
  });
  console.log(`  Deleted ${releaseDateDelete.count} ReleaseDate records`);
  
  // Delete UserCollection records
  const userCollectionDelete = await prisma.userCollection.deleteMany({
    where: {
      collectionId: { in: collectionIds },
    },
  });
  console.log(`  Deleted ${userCollectionDelete.count} UserCollection records`);
  
  // Delete CollectionHistory records
  const historyDelete = await prisma.collectionHistory.deleteMany({
    where: {
      collectionId: { in: collectionIds },
    },
  });
  console.log(`  Deleted ${historyDelete.count} CollectionHistory records`);
  
  // Set mainImageId to null on all models (to avoid foreign key issues)
  console.log('\nClearing mainImageId references...');
  const mainImageUpdate = await prisma.model.updateMany({
    where: {
      collectionId: { in: collectionIds },
      mainImageId: { not: null },
    },
    data: {
      mainImageId: null,
    },
  });
  console.log(`  Cleared mainImageId on ${mainImageUpdate.count} models`);
  
  // Set imageId to null on all variants (to avoid foreign key issues)
  console.log('\nClearing variant imageId references...');
  const variantImageUpdate = await prisma.variant.updateMany({
    where: {
      modelId: { in: modelIds },
      imageId: { not: null },
    },
    data: {
      imageId: null,
    },
  });
  console.log(`  Cleared imageId on ${variantImageUpdate.count} variants`);
  
  // Get all images linked to these models/variants
  const allLinkedImages = await prisma.image.findMany({
    where: {
      OR: [
        { modelId: { in: modelIds } },
        { variantId: { in: variantIds } },
      ],
    },
    select: {
      id: true,
      path: true,
    },
  });
  
  // Separate gallery images from regular images by path pattern
  // Gallery images are stored in /gallery/ path
  const galleryImageIds = allLinkedImages
    .filter(img => img.path && img.path.includes('/gallery/'))
    .map(img => img.id);
  const regularImageIds = allLinkedImages
    .filter(img => !img.path || !img.path.includes('/gallery/'))
    .map(img => img.id);
  
  // Unlink gallery images from these models (set modelId/variantId to null)
  // Gallery images should remain in the gallery even after Elite 64 deletion
  if (galleryImageIds.length > 0) {
    console.log('\nUnlinking gallery images from models...');
    const galleryUnlink = await prisma.image.updateMany({
      where: {
        id: { in: galleryImageIds },
      },
      data: {
        modelId: null,
        variantId: null,
      },
    });
    console.log(`  Unlinked ${galleryUnlink.count} gallery images`);
  }
  
  // Delete regular Images linked to these models/variants
  if (regularImageIds.length > 0) {
    console.log('\nDeleting Images...');
    const imagesDelete = await prisma.image.deleteMany({
      where: {
        id: { in: regularImageIds },
      },
    });
    console.log(`  Deleted ${imagesDelete.count} Image records`);
  } else {
    console.log('\nNo regular images to delete');
  }
  
  // Delete Variants (Images are gone, so this should work)
  console.log('\nDeleting Variants...');
  const variantsDelete = await prisma.variant.deleteMany({
    where: {
      modelId: { in: modelIds },
    },
  });
  console.log(`  Deleted ${variantsDelete.count} Variant records`);
  
  // Delete Models (Variants and Images are gone, so this should work)
  console.log('\nDeleting Models...');
  const modelsDelete = await prisma.model.deleteMany({
    where: {
      collectionId: { in: collectionIds },
    },
  });
  console.log(`  Deleted ${modelsDelete.count} Model records`);
  
  // Now delete SubSeries (Models are gone, so this should work)
  const subSeriesDelete = await prisma.subSeries.deleteMany({
    where: {
      collectionId: { in: collectionIds },
    },
  });
  console.log(`  Deleted ${subSeriesDelete.count} SubSeries records`);
  
  // Finally delete all Elite 64 collections
  console.log('\nDeleting collections from database...');
  const deleteResult = await prisma.collection.deleteMany({
    where: {
      name: 'Elite 64',
    },
  });

  console.log(`\n=== Deletion Summary ===`);
  console.log(`Collections deleted: ${deleteResult.count}`);
  console.log(`Models deleted: ${totalModelsDeleted}`);
  console.log(`Variants deleted: ${totalVariantsDeleted}`);
  console.log(`Image records deleted: ${totalImagesDeleted}`);
  console.log(`Physical files deleted: ${totalFilesDeleted}`);
  console.log('\nElite 64 collection completely removed!');
}

main()
  .catch((err) => {
    console.error('Error during deletion:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

