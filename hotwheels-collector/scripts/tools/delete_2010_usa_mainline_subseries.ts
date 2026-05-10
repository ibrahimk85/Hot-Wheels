/**
 * Script to delete 2010 USA Mainline SubSeries data and images
 * This deletes only the "Mainline (USA)" SubSeries, not the entire collection
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Delete 2010 USA Mainline SubSeries Data & Images ===\n');

  // Find 2010 Mainline collection (notes: null)
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2010,
        notes: null,
      },
    },
  });

  if (!collection) {
    console.log('2010 Mainline collection not found.');
    return;
  }

  console.log(`Found collection: id=${collection.id}, name=${collection.name}`);

  // Find "Mainline (USA)" SubSeries
  const usaSubSeries = await prisma.subSeries.findFirst({
    where: {
      name: 'Mainline (USA)',
      collectionId: collection.id,
    },
  });

  if (!usaSubSeries) {
    console.log('Mainline (USA) SubSeries not found.');
    return;
  }

  console.log(`Found SubSeries: id=${usaSubSeries.id}, name=${usaSubSeries.name}`);

  // Get all models in this SubSeries
  const models = await prisma.model.findMany({
    where: {
      subSeriesId: usaSubSeries.id,
    },
    select: { id: true },
  });

  const modelIds = models.map(m => m.id);
  console.log(`Models in Mainline (USA): ${modelIds.length}`);

  // Delete variants
  const deleteVariantsResult = await prisma.variant.deleteMany({
    where: {
      year: 2010,
      modelId: { in: modelIds },
    },
  });
  console.log(`Deleted variants: ${deleteVariantsResult.count}`);

  // Delete images
  const deleteImagesResult = await prisma.image.deleteMany({
    where: {
      OR: [
        {
          path: {
            startsWith: '/images/hotwheels/2010/usa/mainline/',
          },
        },
        {
          variant: {
            modelId: { in: modelIds },
          },
        },
        {
          modelId: { in: modelIds },
        },
      ],
    },
  });
  console.log(`Deleted images: ${deleteImagesResult.count}`);

  // Delete models
  const deleteModelsResult = await prisma.model.deleteMany({
    where: {
      id: { in: modelIds },
    },
  });
  console.log(`Deleted models: ${deleteModelsResult.count}`);

  // Delete SubSeries
  await prisma.subSeries.delete({
    where: { id: usaSubSeries.id },
  });
  console.log('Deleted SubSeries: Mainline (USA)');

  // Filesystem cleanup
  const mainlineDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2010', 'usa', 'mainline');
  if (fs.existsSync(mainlineDir)) {
    await fs.promises.rm(mainlineDir, { recursive: true, force: true });
    console.log('Deleted filesystem folder');
  }

  console.log('\n✅ 2010 USA Mainline SubSeries data and images deleted.');
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
