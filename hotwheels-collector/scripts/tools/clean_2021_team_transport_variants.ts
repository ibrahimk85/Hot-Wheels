/**
 * Clean incorrect 2021 Team Transport variants
 * 
 * Usage:
 *   npx ts-node scripts/tools/clean_2021_team_transport_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const targetYear = 2021;
const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`2021 Team Transport Variant Temizleme`);
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

  let deletedCount = 0;

  for (const subSeries of collection.subSeries) {
    for (const model of subSeries.models) {
      // Delete variants that only have subSeriesName as releaseName (incorrect format)
      for (const variant of model.variants) {
        if (variant.releaseName === subSeries.name || variant.releaseName === subSeries.name.replace(/\[\]$/, '')) {
          await prisma.variant.delete({
            where: { id: variant.id },
          });
          deletedCount++;
          console.log(`Deleted variant: ${variant.releaseName} (Model: ${model.castingName})`);
        }
      }
    }
  }

  console.log(`\n\n========================================`);
  console.log(`Tamamlandı!`);
  console.log(`========================================\n`);
  console.log(`Toplam ${deletedCount} yanlış variant silindi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
