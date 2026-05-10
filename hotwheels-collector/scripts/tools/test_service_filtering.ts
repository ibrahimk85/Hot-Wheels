/**
 * Test the actual service filtering logic
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Simulate the service logic
const prisma = new PrismaClient();

async function testServiceLogic() {
  console.log('Testing service filtering logic...\n');

  // Simulate filters: year=2018, collectionId=undefined
  const filters = {
    year: 2018,
    collectionId: undefined as number | undefined,
  };

  // This is the service logic from variant.service.ts
  let actualCollectionId = filters.collectionId;
  if (!actualCollectionId && filters.year) {
    const mainlineCollection = await prisma.collection.findFirst({
      where: {
        name: 'Mainline',
        year: {
          year: filters.year,
        },
      },
      select: { id: true },
    });
    if (mainlineCollection) {
      actualCollectionId = mainlineCollection.id;
      console.log(`✓ Auto-filtered to Mainline collection (ID: ${actualCollectionId})`);
    }
  }

  // Now query variants with this logic
  const variantWhere: any = {
    year: filters.year ?? undefined,
  };

  if (actualCollectionId) {
    variantWhere.model = {
      collectionId: actualCollectionId,
    };
  }

  const variants = await prisma.variant.findMany({
    where: variantWhere,
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
    take: 10,
  });

  console.log(`\nFound ${variants.length} variants (showing first 10):`);
  variants.forEach(v => {
    console.log(`  - ${v.model.castingName} (Collection: ${v.model.collection.name})`);
  });

  // Check if all are Mainline
  const nonMainline = variants.filter(v => v.model.collection.name !== 'Mainline');
  if (nonMainline.length > 0) {
    console.log(`\n✗ ERROR: Found ${nonMainline.length} non-Mainline variants!`);
  } else {
    console.log(`\n✓ All variants are from Mainline collection`);
  }

  // Test with collectionId explicitly set
  console.log('\n\nTest 2: With collectionId explicitly set to undefined (simulating page.tsx)');
  const filters2 = {
    year: 2018,
    collectionId: undefined as number | undefined,
  };

  // This simulates what page.tsx does: passes undefined explicitly
  let actualCollectionId2 = filters2.collectionId;
  console.log(`  actualCollectionId2 before check: ${actualCollectionId2}`);
  console.log(`  !actualCollectionId2: ${!actualCollectionId2}`);
  console.log(`  filters2.year: ${filters2.year}`);
  console.log(`  Condition (!actualCollectionId2 && filters2.year): ${!actualCollectionId2 && filters2.year}`);

  if (!actualCollectionId2 && filters2.year) {
    const mainlineCollection = await prisma.collection.findFirst({
      where: {
        name: 'Mainline',
        year: {
          year: filters2.year,
        },
      },
      select: { id: true },
    });
    if (mainlineCollection) {
      actualCollectionId2 = mainlineCollection.id;
      console.log(`  ✓ Auto-filtered to Mainline collection (ID: ${actualCollectionId2})`);
    }
  } else {
    console.log(`  ✗ Auto-filtering did NOT trigger!`);
  }
}

testServiceLogic()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














