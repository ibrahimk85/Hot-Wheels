/**
 * Test script to verify TH/STH and additional tables import.
 * Checks:
 * - COL# numbers start from 366
 * - All variants have Toy#
 * - All variants have images
 * - SubSeries are correctly created
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2018 Mainline Additional Tables (TH/STH and beyond)...\n');

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

  // Get all subseries for additional tables (excluding regular mainline subseries)
  // Note: SQLite doesn't support case-insensitive mode, so we'll filter manually
  const allSubSeries = await prisma.subSeries.findMany({
    where: {
      collectionId: mainlineCollection.id,
    },
  });
  
  const additionalSubSeries = allSubSeries.filter(sub => {
    const name = sub.name.toLowerCase();
    return name.includes('treasure hunt') ||
           name.includes('art cars') ||
           name.includes('robots') ||
           name.includes('50th') ||
           name.includes('target') ||
           name.includes('walmart') ||
           name.includes('kmart') ||
           name.includes('kroger') ||
           name.includes('toys r us') ||
           name.includes('walgreens') ||
           name.includes('daredevil') ||
           name.includes('chase');
  });

  console.log(`Found ${additionalSubSeries.length} additional subseries:\n`);
  additionalSubSeries.forEach(sub => {
    console.log(`  - ${sub.name}`);
  });

  // Get all variants from these subseries
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      model: {
        collectionId: mainlineCollection.id,
        subSeriesId: {
          in: additionalSubSeries.map(s => s.id),
        },
      },
    },
    include: {
      model: {
        select: {
          castingName: true,
          subSeries: {
            select: {
              name: true,
            },
          },
        },
      },
      images: true,
    },
    orderBy: [
      { cardNumber: 'asc' },
    ],
  });

  console.log(`\nTotal variants: ${variants.length}\n`);

  // Check COL# numbers
  const cardNumbers = variants.map(v => v.cardNumber).filter(Boolean);
  const numericCardNumbers = cardNumbers
    .map(cn => {
      const num = parseInt(cn || '', 10);
      return isNaN(num) ? null : num;
    })
    .filter((num): num is number => num !== null);

  if (numericCardNumbers.length > 0) {
    const minCardNumber = Math.min(...numericCardNumbers);
    const maxCardNumber = Math.max(...numericCardNumbers);
    console.log(`📊 COL# Range: ${minCardNumber} - ${maxCardNumber}`);
    
    if (minCardNumber < 366) {
      console.warn(`  ⚠️  Some COL# numbers are less than 366!`);
      const lowNumbers = numericCardNumbers.filter(n => n < 366);
      console.warn(`  Found ${lowNumbers.length} variants with COL# < 366`);
    } else {
      console.log(`  ✅ All COL# numbers start from 366 or higher`);
    }
  }

  // Check for variants without Toy#
  const variantsWithoutToyNumber = variants.filter(v => !v.toyNumber);
  if (variantsWithoutToyNumber.length > 0) {
    console.warn(`\n⚠️  Variants WITHOUT Toy#: ${variantsWithoutToyNumber.length}`);
    variantsWithoutToyNumber.forEach(v => {
      console.warn(`  - ${v.model.castingName} (COL#: ${v.cardNumber || 'N/A'})`);
    });
  } else {
    console.log(`\n✅ All variants have Toy#`);
  }

  // Check for variants without images
  const variantsWithoutImages = variants.filter(v => 
    !v.imageId && (!v.images || v.images.length === 0)
  );
  if (variantsWithoutImages.length > 0) {
    console.warn(`\n⚠️  Variants WITHOUT images: ${variantsWithoutImages.length}`);
    variantsWithoutImages.forEach(v => {
      console.warn(`  - ${v.model.castingName} (Toy#: ${v.toyNumber || 'N/A'}, COL#: ${v.cardNumber || 'N/A'})`);
    });
  } else {
    console.log(`\n✅ All variants have images`);
  }

  // Group by subseries
  const bySubSeries = new Map<string, typeof variants>();
  variants.forEach(v => {
    const subSeriesName = v.model.subSeries?.name || 'Unknown';
    if (!bySubSeries.has(subSeriesName)) {
      bySubSeries.set(subSeriesName, []);
    }
    bySubSeries.get(subSeriesName)!.push(v);
  });

  console.log(`\n📊 Breakdown by SubSeries:`);
  bySubSeries.forEach((variantList, subSeriesName) => {
    const withoutImages = variantList.filter(v => !v.imageId && (!v.images || v.images.length === 0));
    const withoutToyNumber = variantList.filter(v => !v.toyNumber);
    console.log(`\n  ${subSeriesName}:`);
    console.log(`    Total: ${variantList.length}`);
    console.log(`    Without Toy#: ${withoutToyNumber.length}`);
    console.log(`    Without images: ${withoutImages.length}`);
    
    if (withoutImages.length > 0 || withoutToyNumber.length > 0) {
      console.warn(`    ⚠️  Issues found in ${subSeriesName}`);
    }
  });

  // Summary
  console.log(`\n📈 Summary:`);
  console.log(`  Total variants: ${variants.length}`);
  console.log(`  Variants without Toy#: ${variantsWithoutToyNumber.length}`);
  console.log(`  Variants without images: ${variantsWithoutImages.length}`);
  console.log(`  SubSeries count: ${additionalSubSeries.length}`);
  
  if (variantsWithoutToyNumber.length === 0 && variantsWithoutImages.length === 0) {
    console.log(`\n✅ All checks passed!`);
  } else {
    console.log(`\n⚠️  Some issues found. Please review above.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

