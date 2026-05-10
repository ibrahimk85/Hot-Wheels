import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning 2018 Mainline Additional Tables (TH/STH and beyond)...');
  
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2018,
      },
    },
  });

  if (!mainlineCollection) {
    console.log('2018 Mainline collection not found.');
    return;
  }

  // Get all subseries that are TH/STH or additional tables
  const allSubSeries = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });

  const additionalSubSeries = allSubSeries.filter(sub => {
    const name = sub.name.toLowerCase();
    return name.includes('treasure hunt') ||
           name.includes('art cars') ||
           name.includes('robots') ||
           name.includes('50th') ||
           name.includes('target') ||
           name.includes('walmart') ||
           name.includes('kmart') ||
           name.includes('kroger') ||
           name.includes('toys r us') ||
           name.includes('walgreens') ||
           name.includes('daredevil') ||
           name.includes('chase');
  });

  console.log(`Found ${additionalSubSeries.length} additional subseries to clean`);

  // Delete variants from these subseries
  for (const subSeries of additionalSubSeries) {
    const variants = await prisma.variant.findMany({
      where: {
        year: 2018,
        model: {
          subSeriesId: subSeries.id,
        },
      },
      include: {
        images: true,
      },
    });

    if (variants.length > 0) {
      // Delete images
      const imageIds = variants.flatMap(v => v.images.map(img => img.id));
      if (imageIds.length > 0) {
        await prisma.image.deleteMany({
          where: {
            id: { in: imageIds },
          },
        });
        console.log(`  Deleted ${imageIds.length} images from ${subSeries.name}`);
      }

      // Delete variants
      const variantIds = variants.map(v => v.id);
      await prisma.variant.deleteMany({
        where: {
          id: { in: variantIds },
        },
      });
      console.log(`  Deleted ${variantIds.length} variants from ${subSeries.name}`);
    }
  }

  // Delete models from these subseries (if they have no other variants)
  for (const subSeries of additionalSubSeries) {
    const models = await prisma.model.findMany({
      where: {
        subSeriesId: subSeries.id,
      },
      include: {
        variants: true,
      },
    });

    for (const model of models) {
      if (model.variants.length === 0) {
        await prisma.model.delete({
          where: { id: model.id },
        });
        console.log(`  Deleted model: ${model.castingName}`);
      }
    }

    // Delete subseries if no models
    const remainingModels = await prisma.model.count({
      where: {
        subSeriesId: subSeries.id,
      },
    });

    if (remainingModels === 0) {
      await prisma.subSeries.delete({
        where: { id: subSeries.id },
      });
      console.log(`  Deleted subseries: ${subSeries.name}`);
    }
  }

  console.log('\n✅ Clean complete!');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














