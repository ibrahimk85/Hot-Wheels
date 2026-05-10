import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking 2018 Mainline data...\n');

  // Find 2018 Mainline collection
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

  console.log(`Mainline Collection ID: ${mainlineCollection.id}`);

  // Count all variants in Mainline collection
  const allVariants = await prisma.variant.count({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  console.log(`\nTotal variants in 2018 Mainline: ${allVariants}`);

  // Count by subseries
  const subSeriesList = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
    include: {
      _count: {
        select: {
          models: true,
        },
      },
    },
  });

  console.log(`\nSubSeries count: ${subSeriesList.length}`);
  
  // Count variants per subseries
  for (const subSeries of subSeriesList) {
    const variantCount = await prisma.variant.count({
      where: {
        year: 2018,
        model: {
          subSeriesId: subSeries.id,
        },
      },
    });
    
    const modelCount = await prisma.model.count({
      where: {
        subSeriesId: subSeries.id,
      },
    });
    
    console.log(`  ${subSeries.name}: ${variantCount} variants, ${modelCount} models`);
  }

  // Check variants with Toy#
  const variantsWithToyNumber = await prisma.variant.count({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      toyNumber: {
        not: null,
      },
    },
  });

  console.log(`\nVariants with Toy#: ${variantsWithToyNumber} / ${allVariants}`);

  // Check variants with images
  const variantsWithImages = await prisma.variant.count({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      imageId: {
        not: null,
      },
    },
  });

  console.log(`Variants with images: ${variantsWithImages} / ${allVariants}`);

  // Check TH and STH variants
  const thVariants = await prisma.variant.count({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      isTreasureHunt: true,
    },
  });

  const sthVariants = await prisma.variant.count({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      isSuperTreasureHunt: true,
    },
  });

  console.log(`\nTH variants: ${thVariants}`);
  console.log(`STH variants: ${sthVariants}`);

  // Check COL# range
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      cardNumber: {
        not: null,
      },
    },
    select: {
      cardNumber: true,
    },
    take: 10,
  });

  console.log(`\nSample COL# values:`, variants.map(v => v.cardNumber).slice(0, 10));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














