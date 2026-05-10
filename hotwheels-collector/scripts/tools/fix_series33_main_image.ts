import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const model = await prisma.model.findFirst({
    where: {
      castingName: 'Rally Trailer & Ford RS200',
      collection: {
        name: 'Team Transport',
        year: { year: 2021 },
      },
    },
    include: {
      images: {
        where: {
          modelId: { not: null },
        },
      },
    },
  });

  if (!model) {
    console.log('Model bulunamadı!');
    return;
  }

  console.log(`Model: ${model.castingName}`);
  console.log(`Main Image ID: ${model.mainImageId || 'YOK'}`);
  console.log(`Model Images: ${model.images.length}`);

  if (!model.mainImageId) {
    // Find carded image
    const cardedImage = await prisma.image.findFirst({
      where: {
        path: { contains: 'carded-GTT28-33' },
        modelId: model.id,
      },
    });

    if (cardedImage) {
      await prisma.model.update({
        where: { id: model.id },
        data: { mainImageId: cardedImage.id },
      });
      console.log(`✅ Main image set to: ${cardedImage.path}`);
    } else {
      console.log('❌ Carded image bulunamadı!');
      // List all model images
      const allImages = await prisma.image.findMany({
        where: { modelId: model.id },
      });
      console.log(`Available images:`);
      allImages.forEach(img => console.log(`  - ${img.path}`));
    }
  } else {
    const mainImg = await prisma.image.findUnique({
      where: { id: model.mainImageId },
    });
    if (mainImg) {
      console.log(`Main Image Path: ${mainImg.path}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
