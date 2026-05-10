/**
 * Check what SubSeries records exist for Boulevard
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const targetYear = 2025;

async function main() {
  console.log('=== CHECKING BOULEVARD SUBSERIES ===\n');

  const boulevardCollection = await prisma.collection.findFirst({
    where: {
      name: 'Boulevard',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!boulevardCollection) {
    console.error('Boulevard collection not found!');
    return;
  }

  console.log(`Collection ID: ${boulevardCollection.id}`);
  console.log(`SubSeries count: ${boulevardCollection.subSeries.length}\n`);

  console.log('SubSeries names:');
  boulevardCollection.subSeries.forEach(ss => {
    console.log(`  - ${ss.name} (ID: ${ss.id})`);
  });

  // Check if any subSeries names look like model names
  const modelNames = await prisma.model.findMany({
    where: {
      collectionId: boulevardCollection.id,
    },
    select: {
      castingName: true,
    },
    distinct: ['castingName'],
  });

  console.log(`\nModel names in Boulevard:`);
  modelNames.slice(0, 10).forEach(m => {
    console.log(`  - ${m.castingName}`);
  });

  // Check if any subSeries name matches a model name
  const subSeriesNames = boulevardCollection.subSeries.map(ss => ss.name);
  const modelNameList = modelNames.map(m => m.castingName);

  const suspicious = subSeriesNames.filter(name => 
    modelNameList.some(modelName => 
      name.toLowerCase().includes(modelName.toLowerCase()) ||
      modelName.toLowerCase().includes(name.toLowerCase())
    )
  );

  if (suspicious.length > 0) {
    console.log(`\n⚠️  Suspicious SubSeries names (might be model names):`);
    suspicious.forEach(name => {
      console.log(`  - ${name}`);
    });
  }
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




