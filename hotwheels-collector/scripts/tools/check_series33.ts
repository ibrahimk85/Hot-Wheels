import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      year: 2021,
      cardNumber: '33',
      model: {
        collection: {
          name: 'Team Transport',
        },
      },
    },
    include: {
      model: true,
      images: true,
    },
  });

  console.log(`\nSeries#33 Variants (${variants.length} adet):\n`);
  variants.forEach(v => {
    console.log(`  - ${v.releaseName}`);
    console.log(`    Model: ${v.model.castingName}`);
    console.log(`    Images: ${v.images.length}`);
    if (v.images.length > 0) {
      v.images.forEach(img => console.log(`      - ${img.path}`));
    }
    console.log('');
  });

  const model = await prisma.model.findFirst({
    where: {
      variants: {
        some: {
          year: 2021,
          cardNumber: '33',
        },
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

  if (model) {
    console.log(`\nModel: ${model.castingName}`);
    console.log(`Main Image: ${model.mainImageId ? 'Var' : 'Yok'}`);
    if (model.mainImageId) {
      const mainImg = await prisma.image.findUnique({
        where: { id: model.mainImageId },
      });
      if (mainImg) {
        console.log(`  Path: ${mainImg.path}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
