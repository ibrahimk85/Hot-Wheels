/**
 * Delete Boulevard 2024 models without images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteModelsWithoutImages() {
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

  console.log(`Toplam ${models.length} model bulundu.`);
  console.log(`Görseli olmayan ${modelsWithoutImages.length} model:\n`);

  if (modelsWithoutImages.length === 0) {
    console.log('Görseli olmayan model bulunamadı.');
    await prisma.$disconnect();
    return;
  }

  // List models to be deleted
  const modelIds: number[] = [];
  modelsWithoutImages.forEach((model) => {
    console.log(`- ID: ${model.id}, Name: ${model.castingName}, SubSeries: ${model.subSeries?.name || 'N/A'}`);
    modelIds.push(model.id);
  });

  console.log(`\n${modelIds.length} model silinecek.`);
  console.log('Model ID\'leri:', modelIds.join(', '));

  // Delete models (variants will be cascade deleted)
  for (const modelId of modelIds) {
    await prisma.model.delete({
      where: { id: modelId },
    });
    console.log(`✓ Model ID ${modelId} silindi.`);
  }

  console.log(`\n✅ ${modelIds.length} model başarıyla silindi.`);

  await prisma.$disconnect();
}

deleteModelsWithoutImages()
  .catch((error) => {
    console.error('Hata:', error);
    process.exit(1);
  });


