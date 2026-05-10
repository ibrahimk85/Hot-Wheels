/**
 * Script to delete all image records and variant imageId references
 * for 2010 USA Mainline variants before re-downloading with new naming scheme.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding 2010 Mainline (USA) collection...');
  
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2010,
        notes: null,
      },
    },
  });

  if (!mainlineCollection) {
    throw new Error('2010 Mainline collection not found.');
  }

  const usaSubSeries = await prisma.subSeries.findFirst({
    where: {
      name: 'Mainline (USA)',
      collectionId: mainlineCollection.id,
    },
  });

  if (!usaSubSeries) {
    throw new Error('Mainline (USA) SubSeries not found.');
  }

  // Find all variants in this sub-series
  const variants = await prisma.variant.findMany({
    where: {
      year: 2010,
      model: {
        collectionId: mainlineCollection.id,
        subSeriesId: usaSubSeries.id,
      },
    },
    include: {
      images: true,
      model: {
        include: {
          images: true,
        },
      },
    },
  });

  console.log(`Found ${variants.length} variants to clean up.`);

  let imageCount = 0;
  let variantUpdateCount = 0;

  // Delete all images associated with these variants and models
  for (const variant of variants) {
    // Delete variant images
    if (variant.images.length > 0) {
      await prisma.image.deleteMany({
        where: {
          variantId: variant.id,
        },
      });
      imageCount += variant.images.length;
    }

    // Delete model images (only if they're in the 2010/usa/mainline path)
    const modelImagesToDelete = variant.model.images.filter(img => 
      img.path.includes('/2010/usa/mainline/')
    );
    
    if (modelImagesToDelete.length > 0) {
      await prisma.image.deleteMany({
        where: {
          id: { in: modelImagesToDelete.map(img => img.id) },
        },
      });
      imageCount += modelImagesToDelete.length;
    }

    // Clear variant imageId reference
    if (variant.imageId) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: null },
      });
      variantUpdateCount++;
    }
  }

  console.log(`\n✅ Cleanup complete:`);
  console.log(`   - Deleted ${imageCount} image records`);
  console.log(`   - Cleared imageId from ${variantUpdateCount} variants`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
