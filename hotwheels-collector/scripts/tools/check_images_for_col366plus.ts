import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking images for COL# 366+ variants...\n');

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

  // Get variants with COL# >= 366
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      cardNumber: {
        gte: '366',
      },
    },
    include: {
      model: {
        include: {
          subSeries: true,
        },
      },
      images: true,
    },
    orderBy: {
      cardNumber: 'asc',
    },
    take: 20,
  });

  console.log(`Found ${variants.length} variants with COL# >= 366 (showing first 20)\n`);

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'mainline');

  for (const variant of variants) {
    const subSeriesName = variant.model.subSeries?.name || 'Unknown';
    const subSeriesSlug = subSeriesName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const imageDir = path.join(baseDir, subSeriesSlug);
    const expectedFileName = `${variant.toyNumber}.jpg`;
    const expectedPath = path.join(imageDir, expectedFileName);
    
    const fileExists = fs.existsSync(expectedPath);
    const hasImageId = variant.imageId !== null && variant.imageId !== undefined;
    const hasImageRecord = variant.images.length > 0;

    console.log(`COL# ${variant.cardNumber} | Toy# ${variant.toyNumber} | ${variant.model.castingName}`);
    console.log(`  SubSeries: ${subSeriesName} (${subSeriesSlug})`);
    console.log(`  Expected file: ${expectedPath}`);
    console.log(`  File exists: ${fileExists ? '✓' : '✗'}`);
    console.log(`  Has imageId: ${hasImageId ? '✓' : '✗'} (${variant.imageId || 'null'})`);
    console.log(`  Has image record: ${hasImageRecord ? '✓' : '✗'}`);
    if (hasImageRecord) {
      variant.images.forEach(img => {
        console.log(`    Image path: ${img.path}`);
      });
    }
    console.log('');
  }

  // Count variants without images
  const variantsWithoutImages = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
      },
      cardNumber: {
        gte: '366',
      },
      OR: [
        { imageId: null },
        { imageId: undefined },
        { images: { none: {} } },
      ],
    },
    include: {
      model: {
        include: {
          subSeries: true,
        },
      },
    },
  });

  console.log(`\nTotal variants without images: ${variantsWithoutImages.length}`);
  
  // Group by subseries
  const bySubSeries = new Map<string, number>();
  variantsWithoutImages.forEach(v => {
    const subSeriesName = v.model.subSeries?.name || 'Unknown';
    bySubSeries.set(subSeriesName, (bySubSeries.get(subSeriesName) || 0) + 1);
  });

  console.log('\nBreakdown by SubSeries:');
  bySubSeries.forEach((count, name) => {
    console.log(`  ${name}: ${count}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














