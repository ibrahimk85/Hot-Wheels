/**
 * Check specific missing variants for 2019 Team Transport
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_missing_2019_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const targetYear = 2019;
const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`2019 Team Transport Eksik Variant Kontrolü`);
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
    { subSeries: 'Mix 1[]', seriesNumber: '7' },
    { subSeries: 'Mix 1[]', seriesNumber: '9' },
    { subSeries: 'Mix 2[]', seriesNumber: '10' },
    { subSeries: 'Mix 2[]', seriesNumber: '11' },
    { subSeries: 'Mix 3[]', seriesNumber: '13' },
    { subSeries: 'Supreme Exclusive[]', toyNumber: 'GJY52' },
  ];

  for (const check of missingChecks) {
    const subSeries = collection.subSeries.find(ss => ss.name === check.subSeries);
    
    if (!subSeries) {
      console.log(`❌ SubSeries '${check.subSeries}' not found`);
      continue;
    }

    console.log(`\n${check.subSeries}:`);
    
    if (check.seriesNumber) {
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
        console.log(`  ❌ Series# ${check.seriesNumber} - Variant bulunamadı`);
      } else {
        console.log(`  ✅ Series# ${check.seriesNumber} - ${variants.length} variant bulundu:`);
        for (const variant of variants) {
          console.log(`     - ${variant.model.castingName}: ${variant.releaseName} (ID: ${variant.id})`);
        }
      }
    } else if (check.toyNumber) {
      // Check for model with this castingId (Toy#)
      const models = subSeries.models.filter(m => m.castingId === check.toyNumber);
      
      if (models.length === 0) {
        console.log(`  ❌ Toy# ${check.toyNumber} - Model bulunamadı`);
      } else {
        console.log(`  ✅ Toy# ${check.toyNumber} - ${models.length} model bulundu:`);
        for (const model of models) {
          console.log(`     - ${model.castingName} (ID: ${model.id}, Variants: ${model.variants.length})`);
        }
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
