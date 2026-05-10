/**
 * Check image status for 2010 USA Mainline variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

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
      }
    },
    include: {
      model: true
    }
  });

  const withImage = allVariants.filter(v => v.imageId !== null && v.imageId !== undefined);
  const withoutImage = allVariants.filter(v => v.imageId === null || v.imageId === undefined);

  console.log(`Total variants: ${allVariants.length}`);
  console.log(`With image: ${withImage.length}`);
  console.log(`Without image: ${withoutImage.length}`);

  if (withoutImage.length > 0) {
    console.log(`\nFirst 10 variants without image:`);
    for (const v of withoutImage.slice(0, 10)) {
      console.log(`  - ${v.model.castingName} (Toy#: ${v.toyNumber}, COL#: ${v.cardNumber}, Color: ${v.color || 'none'})`);
    }
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error);
