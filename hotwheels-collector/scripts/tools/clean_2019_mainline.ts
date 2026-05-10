import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning 2019 Mainline data...');
  
  // Find 2019 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2019,
      },
    },
  });

  if (!mainlineCollection) {
    console.log('2019 Mainline collection not found. Nothing to clean.');
    return;
  }

  console.log(`Found 2019 Mainline collection (ID: ${mainlineCollection.id})`);

  // Get all variants for 2019 Mainline
  const variants = await prisma.variant.findMany({
    where: {
      year: 2019,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      images: true,
    },
  });

  console.log(`Found ${variants.length} variants to delete`);

  // Delete images first
  const imageIds = variants.flatMap(v => v.images.map(img => img.id));
  if (imageIds.length > 0) {
    await prisma.image.deleteMany({
      where: {
        id: { in: imageIds },
      },
    });
    console.log(`Deleted ${imageIds.length} images`);
  }

  // Delete variants
  const variantIds = variants.map(v => v.id);
  if (variantIds.length > 0) {
    await prisma.variant.deleteMany({
      where: {
        id: { in: variantIds },
      },
    });
    console.log(`Deleted ${variantIds.length} variants`);
  }

  // Get all models for 2019 Mainline
  const models = await prisma.model.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });

  console.log(`Found ${models.length} models to delete`);

  // Delete models (variants are already deleted, so this should be safe)
  const modelIds = models.map(m => m.id);
  if (modelIds.length > 0) {
    await prisma.model.deleteMany({
      where: {
        id: { in: modelIds },
      },
    });
    console.log(`Deleted ${modelIds.length} models`);
  }

  // Get all subSeries for 2019 Mainline
  const subSeries = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });

  console.log(`Found ${subSeries.length} subSeries to delete`);

  // Delete subSeries
  const subSeriesIds = subSeries.map(s => s.id);
  if (subSeriesIds.length > 0) {
    await prisma.subSeries.deleteMany({
      where: {
        id: { in: subSeriesIds },
      },
    });
    console.log(`Deleted ${subSeriesIds.length} subSeries`);
  }

  // Delete the collection itself
  await prisma.collection.delete({
    where: {
      id: mainlineCollection.id,
    },
  });
  console.log('Deleted 2019 Mainline collection');

  // Delete image files from filesystem
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2019', 'mainline');
  if (fs.existsSync(imageDir)) {
    try {
      fs.rmSync(imageDir, { recursive: true, force: true });
      console.log('Deleted 2019 Mainline image directory');
    } catch (err) {
      console.error('Error deleting image directory:', err);
    }
  }

  console.log('2019 Mainline data and images cleaned successfully!');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

