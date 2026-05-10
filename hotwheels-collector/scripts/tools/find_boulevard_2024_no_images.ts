/**
 * Find Boulevard 2024 models without images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findModelsWithoutImages() {
  console.log('Boulevard 2024 - Görseli olmayan modeller aranıyor...\n');

  const models = await prisma.model.findMany({
    where: {
      collection: {
        name: 'Boulevard',
        year: {
          year: 2024,
        },
      },
    },
    include: {
      variants: {
        include: {
          images: true,
        },
      },
      images: true,
      subSeries: true,
    },
    orderBy: {
      castingName: 'asc',
    },
  });

  const modelsWithoutImages = models.filter((model) => {
    // Model seviyesinde görsel yok
    const hasModelImage = model.images && model.images.length > 0;
    
    // Variant seviyesinde görsel yok
    const hasVariantImage = model.variants.some(
      (variant) => variant.images && variant.images.length > 0
    );

    return !hasModelImage && !hasVariantImage;
  });

  console.log(`\nToplam ${models.length} model bulundu.`);
  console.log(`Görseli olmayan ${modelsWithoutImages.length} model:\n`);

  if (modelsWithoutImages.length === 0) {
    console.log('Görseli olmayan model bulunamadı.');
  } else {
    console.log('='.repeat(60));
    modelsWithoutImages.forEach((model, index) => {
      console.log(`\n${index + 1}. Model ID: ${model.id}`);
      console.log(`   İsim: ${model.castingName}`);
      console.log(`   Alt Seri: ${model.subSeries?.name || 'N/A'}`);
      console.log(`   Varyant Sayısı: ${model.variants.length}`);
      if (model.variants.length > 0) {
        console.log(`   Varyantlar:`);
        model.variants.forEach((v) => {
          console.log(`     - Variant ID: ${v.id}, Yıl: ${v.year}, Series#: ${v.cardNumber || 'N/A'}`);
        });
      }
    });
    console.log('\n' + '='.repeat(60));
    console.log(`\nTOPLAM: ${modelsWithoutImages.length} görseli olmayan model bulundu.`);
  }

  await prisma.$disconnect();
}

findModelsWithoutImages()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


