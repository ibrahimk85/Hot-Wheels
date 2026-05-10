/**
 * Check Boulevard SubSeries records in database
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const targetYear = 2025;

async function main() {
  console.log('=== BOULEVARD SUBSERIES CHECK ===\n');

  // Get Boulevard collection
  const boulevardCollection = await prisma.collection.findFirst({
    where: {
      name: 'Boulevard',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        orderBy: { name: 'asc' },
        include: {
          models: {
            select: {
              id: true,
              castingName: true,
            },
          },
        },
      },
    },
  });

  if (!boulevardCollection) {
    console.error('Boulevard collection not found!');
    return;
  }

  console.log(`Boulevard Collection ID: ${boulevardCollection.id}`);
  console.log(`Total SubSeries: ${boulevardCollection.subSeries.length}\n`);

  console.log('=== SUBSERIES LIST ===\n');
  
  for (const subSeries of boulevardCollection.subSeries) {
    console.log(`📦 ${subSeries.name} (ID: ${subSeries.id})`);
    console.log(`   Models in this SubSeries: ${subSeries.models.length}`);
    
    if (subSeries.models.length > 0) {
      console.log(`   Model names:`);
      subSeries.models.forEach(model => {
        console.log(`     - ${model.castingName}`);
      });
    }
    console.log('');
  }

  // Check if there are any incorrect SubSeries names
  const expectedMixNames = ['Mix 1', 'Mix 2', 'Mix 3', 'Mix 4', 'Mix 5'];
  const actualMixNames = boulevardCollection.subSeries.map(s => s.name);
  
  const incorrectSubSeries = boulevardCollection.subSeries.filter(s => 
    !expectedMixNames.includes(s.name)
  );

  if (incorrectSubSeries.length > 0) {
    console.log('=== INCORRECT SUBSERIES (not Mix 1-5) ===\n');
    for (const subSeries of incorrectSubSeries) {
      console.log(`❌ ${subSeries.name} (ID: ${subSeries.id}) - Should be deleted or renamed`);
      console.log(`   Models: ${subSeries.models.map(m => m.castingName).join(', ')}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Expected SubSeries: Mix 1, Mix 2, Mix 3, Mix 4, Mix 5`);
  console.log(`Actual SubSeries: ${actualMixNames.join(', ')}`);
  console.log(`Incorrect SubSeries: ${incorrectSubSeries.length}`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




