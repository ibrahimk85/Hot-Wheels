import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking 2026 Mainline image matching...\n');

  // Get all 2026 variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2026,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
    select: {
      id: true,
      toyNumber: true,
      cardNumber: true,
      imageId: true,
      images: {
        select: {
          id: true,
          path: true,
        },
      },
      model: {
        select: {
          castingName: true,
        },
      },
    },
    take: 20,
  });

  console.log(`Total 2026 Mainline variants: ${await prisma.variant.count({
    where: {
      year: 2026,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  })}`);

  console.log(`\nVariants with images: ${await prisma.variant.count({
    where: {
      year: 2026,
      imageId: { not: null },
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  })}`);

  console.log(`Variants without images: ${await prisma.variant.count({
    where: {
      year: 2026,
      imageId: null,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  })}`);

  const variantsWithEmptyToy = await prisma.variant.findMany({
    where: {
      year: 2026,
      OR: [
        { toyNumber: null },
        { toyNumber: '' },
      ],
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
    select: {
      id: true,
      toyNumber: true,
      cardNumber: true,
      model: {
        select: {
          castingName: true,
        },
      },
    },
  });
  console.log(`\nVariants with empty Toy#: ${variantsWithEmptyToy.length}`);
  if (variantsWithEmptyToy.length > 0 && variantsWithEmptyToy.length <= 10) {
    console.log('Examples:');
    variantsWithEmptyToy.forEach((v) => {
      console.log(`  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#: ${v.toyNumber || 'null'})`);
    });
  }

  console.log('\nSample variants (first 20):');
  variants.forEach((v) => {
    const hasImage = v.imageId !== null || v.images.length > 0;
    const toyNum = v.toyNumber || '(empty)';
    console.log(
      `  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${toyNum}) - Image: ${hasImage ? 'YES' : 'NO'} ${hasImage && v.images.length > 0 ? `(${v.images[0].path})` : ''}`
    );
  });

  // Check for variants with images but no imageId
  const variantsWithImagesButNoImageId = await prisma.variant.findMany({
    where: {
      year: 2026,
      imageId: null,
      images: {
        some: {},
      },
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
    select: {
      id: true,
      toyNumber: true,
      cardNumber: true,
      images: {
        select: {
          id: true,
          path: true,
        },
        take: 1,
      },
      model: {
        select: {
          castingName: true,
        },
      },
    },
    take: 10,
  });

  if (variantsWithImagesButNoImageId.length > 0) {
    console.log('\n\nVariants with images but no imageId (need fixing):');
    variantsWithImagesButNoImageId.forEach((v) => {
      console.log(
        `  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${v.toyNumber || 'empty'}) - Image ID: ${v.images[0]?.id}, Path: ${v.images[0]?.path}`
      );
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

