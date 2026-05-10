/**
 * Check which 2010 USA variants are missing images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: { year: 2010, notes: null }
    }
  });

  const usaSubSeries = await prisma.subSeries.findFirst({
    where: {
      name: 'Mainline (USA)',
      collectionId: collection!.id
    }
  });

  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2010,
      model: {
        collectionId: collection!.id,
        subSeriesId: usaSubSeries!.id,
      },
      model: {
        castingName: { not: '' } // Exclude empty casting names
      }
    },
    include: {
      model: true
    },
    orderBy: {
      toyNumber: 'asc'
    }
  });

  console.log(`Total valid variants: ${allVariants.length}\n`);

  const withoutImage = allVariants.filter(v => !v.imageId || v.imageId === null);
  const withImage = allVariants.filter(v => v.imageId && v.imageId !== null);

  console.log(`With imageId: ${withImage.length}`);
  console.log(`Without imageId: ${withoutImage.length}\n`);

  if (withoutImage.length > 0) {
    console.log('Variants without imageId:');
    for (const v of withoutImage.slice(0, 20)) {
      console.log(`  - ${v.model.castingName} (Toy#: ${v.toyNumber}, COL#: ${v.cardNumber || 'N/A'}, Color: ${v.color || 'none'})`);
    }
  }

  // Check filesystem
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2010', 'usa', 'mainline');
  let fileCount = 0;
  if (fs.existsSync(imageDir)) {
    const files = await fs.promises.readdir(imageDir, { recursive: true });
    fileCount = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length;
  }
  console.log(`\nImages in filesystem: ${fileCount}`);

  await prisma.$disconnect();
}

main()
  .catch(console.error);
