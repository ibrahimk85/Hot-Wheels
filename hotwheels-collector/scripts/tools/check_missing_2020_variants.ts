/**
 * Check specific missing variants for 2020 Team Transport
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_missing_2020_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const targetYear = 2020;
const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`2020 Team Transport Eksik Variant Kontrolü`);
  console.log(`========================================\n`);

  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Team Transport',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        include: {
          models: {
            include: {
              variants: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    console.log(`⚠️  Collection not found`);
    return;
  }

  const missingChecks = [
    { subSeries: 'Mix 1[]', seriesNumber: '17' },
    { subSeries: 'Mix 2[]', seriesNumber: '19' },
    { subSeries: 'Mix 2[]', seriesNumber: '20' },
    { subSeries: 'Mix 2[]', seriesNumber: '21' },
    { subSeries: 'Mix 2[]', seriesNumber: '22' },
    { subSeries: 'Mix 3[]', seriesNumber: '23' },
    { subSeries: 'Mix 3[]', seriesNumber: '25' },
  ];

  for (const check of missingChecks) {
    const subSeries = collection.subSeries.find(ss => ss.name === check.subSeries);
    
    if (!subSeries) {
      console.log(`❌ SubSeries '${check.subSeries}' not found`);
      continue;
    }

    console.log(`\n${check.subSeries} - Series# ${check.seriesNumber}:`);
    
    // Check for variant with this cardNumber
    const variants = await prisma.variant.findMany({
      where: {
        model: {
          subSeriesId: subSeries.id,
          collectionId: collection.id,
        },
        cardNumber: check.seriesNumber,
        year: targetYear,
      },
      include: {
        model: true,
      },
    });

    if (variants.length === 0) {
      console.log(`  ❌ Variant bulunamadı`);
    } else {
      console.log(`  ✅ ${variants.length} variant bulundu:`);
      for (const variant of variants) {
        console.log(`     - ${variant.model.castingName}: ${variant.releaseName} (ID: ${variant.id})`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
