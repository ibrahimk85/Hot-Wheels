/**
 * Script to check if Team Transport 2018-2019 images are correctly associated with variants
 * 
 * Usage:
 *   npx ts-node scripts/tools/check_team_transport_images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_YEARS = [2018, 2019];
const COLLECTION_NAME = 'Team Transport';

async function main() {
  console.log('========================================');
  console.log('Team Transport 2018-2019 Resim Kontrolü');
  console.log('========================================');
  console.log('');

  for (const year of TARGET_YEARS) {
    console.log(`\n${year} yılı kontrol ediliyor...`);

    const collection = await prisma.collection.findFirst({
      where: {
        name: COLLECTION_NAME,
        year: { year: year },
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
              },
            },
          },
        },
      },
    });

    if (!collection) {
      console.log(`  ${year}: Collection bulunamadı`);
      continue;
    }

    console.log(`  Collection: ${collection.name} (${collection.subSeries.length} SubSeries)`);

    for (const subSeries of collection.subSeries) {
      console.log(`\n  SubSeries: ${subSeries.name} (${subSeries.models.length} Model)`);

      for (const model of subSeries.models) {
        console.log(`\n    Model: ${model.castingName} (ID: ${model.id})`);
        console.log(`      Variant sayısı: ${model.variants.length}`);

        for (const variant of model.variants) {
          const imageCount = variant.images.length;
          const cardedImages = variant.images.filter(img => 
            img.path.includes('carded-') || img.path.includes('_carded')
          );
          const looseImages = variant.images.filter(img => 
            img.path.includes('loose-') || img.path.includes('_loose')
          );

          console.log(`\n      Variant: ${variant.releaseName || 'N/A'} (ID: ${variant.id})`);
          console.log(`        Toplam resim: ${imageCount}`);
          console.log(`        Carded resim: ${cardedImages.length}`);
          console.log(`        Loose resim: ${looseImages.length}`);

          if (looseImages.length > 0) {
            console.log(`        Loose resim dosyaları:`);
            looseImages.forEach(img => {
              console.log(`          - ${img.path}`);
            });
          }

          if (imageCount === 0) {
            console.log(`        ⚠️  UYARI: Bu variant'ın hiç resmi yok!`);
          }
        }
      }
    }
  }

  console.log('\n========================================');
  console.log('Kontrol tamamlandı!');
  console.log('========================================');
}

main()
  .catch((err) => {
    console.error('Hata:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


