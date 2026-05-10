/**
 * Check 2019 Team Transport variants and images
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_2019_team_transport_variants.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const targetYear = 2019;
const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`2019 Team Transport Variant & Resim Kontrolü`);
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
              variants: {
                include: {
                  images: true,
                },
              },
              images: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    console.log(`⚠️  Collection 'Team Transport' not found for year ${targetYear}`);
    return;
  }

  console.log(`Collection: ${collection.name} (${collection.subSeries.length} SubSeries)\n`);

  let totalModels = 0;
  let totalVariants = 0;
  let modelsWithoutMainImage = 0;
  let variantsWithoutImages = 0;

  for (const subSeries of collection.subSeries) {
    console.log(`\n${subSeries.name} (${subSeries.models.length} model)`);
    
    for (const model of subSeries.models) {
      totalModels++;
      const hasMainImage = model.mainImageId !== null;
      if (!hasMainImage) {
        modelsWithoutMainImage++;
        console.log(`  ⚠️  ${model.castingName} - Ana resim yok`);
      }

      console.log(`  ${model.castingName} (${model.variants.length} variant)`);
      
      for (const variant of model.variants) {
        totalVariants++;
        const imageCount = variant.images.length;
        
        if (imageCount === 0) {
          variantsWithoutImages++;
          console.log(`    ❌ ${variant.releaseName || 'N/A'} - Resim yok (Card#: ${variant.cardNumber})`);
        } else {
          console.log(`    ✅ ${variant.releaseName || 'N/A'} - ${imageCount} resim (Card#: ${variant.cardNumber})`);
        }
      }
    }
  }

  console.log(`\n\n========================================`);
  console.log(`ÖZET`);
  console.log(`========================================\n`);
  console.log(`Toplam Model: ${totalModels}`);
  console.log(`Toplam Variant: ${totalVariants}`);
  console.log(`Ana Resim Eksik Model: ${modelsWithoutMainImage}`);
  console.log(`Resim Eksik Variant: ${variantsWithoutImages}`);
  console.log(``);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
