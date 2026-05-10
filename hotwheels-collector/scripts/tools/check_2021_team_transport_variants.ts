/**
 * Check 2021 Team Transport variants
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_2021_team_transport_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const targetYear = 2021;
const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`2021 Team Transport Variant Kontrolü`);
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

  console.log(`Collection: ${collection.name} (${collection.subSeries.length} SubSeries)\n`);

  for (const subSeries of collection.subSeries) {
    console.log(`\n${subSeries.name} (${subSeries.models.length} model)`);
    
    for (const model of subSeries.models) {
      console.log(`  ${model.castingName} (${model.variants.length} variant)`);
      
      for (const variant of model.variants) {
        console.log(`    - ${variant.releaseName || 'N/A'} (Card#: ${variant.cardNumber}, Year: ${variant.year})`);
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
