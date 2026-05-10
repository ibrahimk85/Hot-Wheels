/**
 * Test script to check variant matching for 2010 USA
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a sample variant
  const variant = await prisma.variant.findFirst({
    where: {
      year: 2010,
      model: {
        collection: {
          name: 'Mainline',
          year: { year: 2010, notes: null }
        },
        subSeries: {
          name: 'Mainline (USA)'
        }
      }
    },
    include: {
      model: true
    }
  });

  if (variant) {
    console.log('Sample variant:');
    console.log(`  Toy#: ${variant.toyNumber}`);
    console.log(`  COL#: ${variant.cardNumber}`);
    console.log(`  Color: ${variant.color || '(null)'}`);
    console.log(`  Model: ${variant.model.castingName}`);
    console.log(`  Year: ${variant.year}`);
  }

  // Test matching
  const testToyNumber = 'R0916';
  const testColNumber = '001';
  const testCastingName = "'67 Shelby GT500";
  const testColor = null;

  console.log('\n=== Testing Match ===');
  console.log(`Toy#: ${testToyNumber}, COL#: ${testColNumber}, Model: ${testCastingName}, Color: ${testColor || '(null)'}`);

  const match = await prisma.variant.findFirst({
    where: {
      toyNumber: testToyNumber,
      cardNumber: testColNumber,
      year: 2010,
      color: testColor,
      model: {
        castingName: testCastingName,
        collection: {
          name: 'Mainline',
          year: { year: 2010, notes: null }
        },
        subSeries: {
          name: 'Mainline (USA)'
        }
      }
    }
  });

  if (match) {
    console.log('✅ Match found!');
  } else {
    console.log('❌ No match found');
    
    // Try without COL#
    const match2 = await prisma.variant.findFirst({
      where: {
        toyNumber: testToyNumber,
        year: 2010,
        color: testColor,
        model: {
          castingName: testCastingName,
          collection: {
            name: 'Mainline',
            year: { year: 2010, notes: null }
          },
          subSeries: {
            name: 'Mainline (USA)'
          }
        }
      }
    });
    
    if (match2) {
      console.log('✅ Match found without COL#');
      console.log(`  COL# in DB: ${match2.cardNumber}`);
    }
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error);
