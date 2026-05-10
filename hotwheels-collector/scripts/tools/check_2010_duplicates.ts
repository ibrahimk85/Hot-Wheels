/**
 * Script to check for duplicate 2010 Year and Mainline Collection records
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for duplicate 2010 Year records...\n');
  
  // Check all 2010 Year records
  const years2010 = await prisma.year.findMany({
    where: { year: 2010 },
    include: {
      collections: {
        include: {
          _count: {
            select: { models: true }
          }
        }
      }
    }
  });

  console.log(`Found ${years2010.length} Year record(s) for 2010:\n`);
  
  for (const year of years2010) {
    console.log(`Year ID: ${year.id}, Year: ${year.year}, Notes: ${year.notes || '(null)'}`);
    console.log(`  Collections: ${year.collections.length}`);
    for (const collection of year.collections) {
      console.log(`    - Collection ID: ${collection.id}, Name: ${collection.name}, Models: ${collection._count.models}`);
    }
    console.log('');
  }

  // Check for duplicate Mainline collections in 2010
  const mainlineCollections = await prisma.collection.findMany({
    where: {
      name: 'Mainline',
      year: {
        year: 2010
      }
    },
    include: {
      year: true,
      _count: {
        select: { models: true }
      }
    }
  });

  console.log(`\nFound ${mainlineCollections.length} Mainline collection(s) for 2010:\n`);
  
  for (const collection of mainlineCollections) {
    console.log(`Collection ID: ${collection.id}, Name: ${collection.name}`);
    console.log(`  Year ID: ${collection.yearId}, Year: ${collection.year.year}, Year Notes: ${collection.year.notes || '(null)'}`);
    console.log(`  Models: ${collection._count.models}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
