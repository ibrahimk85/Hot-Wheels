/**
 * Debug script to check why variant matching fails
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check variants for problematic models
  const testCases = [
    { toy: 'R0922', col: '007', name: 'Nissan Skyline GT-R (R34) (2nd Color)' },
    { toy: 'R0942', col: '025', name: 'Ghostbusters Ecto-1' },
    { toy: 'R0916', col: '001', name: "'67 Shelby GT500" },
  ];

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

  for (const test of testCases) {
    console.log(`\n=== Testing: ${test.name} ===`);
    console.log(`Toy#: ${test.toy}, COL#: ${test.col}`);

    // Parse model name
    let castingName = test.name;
    let colorVariant: string | null = null;
    const variantMatch = test.name.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (variantMatch) {
      castingName = variantMatch[1].trim();
      const parsedDescription = variantMatch[2].trim();
      if (parsedDescription.toLowerCase() !== 'mainline') {
        colorVariant = parsedDescription;
      }
    }

    console.log(`Parsed - Casting: "${castingName}", Color: ${colorVariant || '(null)'}`);

    // Find all variants with this Toy#
    const allVariants = await prisma.variant.findMany({
      where: {
        toyNumber: test.toy,
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

    console.log(`Found ${allVariants.length} variant(s) with Toy# ${test.toy}:`);
    for (const v of allVariants) {
      console.log(`  - ID: ${v.id}, COL#: ${v.cardNumber}, Color: ${v.color || '(null)'}, Model: "${v.model.castingName}"`);
    }

    // Try exact match
    const exactMatch = await prisma.variant.findFirst({
      where: {
        toyNumber: test.toy,
        cardNumber: test.col,
        year: 2010,
        color: colorVariant ?? null,
        model: {
          castingName: castingName,
          collectionId: collection!.id,
          subSeriesId: usaSubSeries!.id,
        }
      }
    });

    if (exactMatch) {
      console.log('✅ Exact match found!');
    } else {
      console.log('❌ No exact match');
    }
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error);
