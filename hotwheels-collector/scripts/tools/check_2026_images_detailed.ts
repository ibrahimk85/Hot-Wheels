import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking 2026 Mainline images in detail...\n');

  // Check variants with imageId
  const variantsWithImageId = await prisma.variant.findMany({
    where: {
      year: 2026,
      imageId: { not: null },
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
          variantId: true,
        },
      },
      model: {
        select: {
          castingName: true,
        },
      },
    },
    take: 10,
  });

  console.log(`Variants with imageId: ${variantsWithImageId.length}`);
  console.log('\nSample variants with imageId:');
  variantsWithImageId.forEach((v) => {
    const imageMatch = v.images.find(img => img.id === v.imageId);
    console.log(
      `  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${v.toyNumber || 'empty'})`
    );
    console.log(`    imageId: ${v.imageId}, Images count: ${v.images.length}`);
    if (imageMatch) {
      console.log(`    ✓ Image found: ${imageMatch.path}`);
    } else {
      console.log(`    ✗ Image NOT found in variant.images array!`);
      // Check if image exists in database
      prisma.image.findUnique({
        where: { id: v.imageId! },
        select: { id: true, path: true, variantId: true },
      }).then((img) => {
        if (img) {
          console.log(`    Image exists but variantId: ${img.variantId} (expected: ${v.id})`);
        } else {
          console.log(`    Image does not exist in database!`);
        }
      });
    }
  });

  // Check all images for 2026 mainline
  const allImages = await prisma.image.findMany({
    where: {
      variant: {
        year: 2026,
        model: {
          collection: {
            name: 'Mainline',
          },
        },
      },
    },
    select: {
      id: true,
      path: true,
      variantId: true,
      variant: {
        select: {
          id: true,
          toyNumber: true,
          cardNumber: true,
          imageId: true,
          model: {
            select: {
              castingName: true,
            },
          },
        },
      },
    },
    take: 10,
  });

  console.log(`\n\nTotal images for 2026 Mainline: ${await prisma.image.count({
    where: {
      variant: {
        year: 2026,
        model: {
          collection: {
            name: 'Mainline',
          },
        },
      },
    },
  })}`);

  console.log('\nSample images:');
  allImages.forEach((img) => {
    if (!img.variant) {
      console.log(`  - Image ID: ${img.id}, Path: ${img.path} - NO VARIANT!`);
      return;
    }
    const imageIdMatches = img.variant.imageId === img.id;
    console.log(
      `  - Image ID: ${img.id}, Path: ${img.path}`
    );
    console.log(
      `    Variant: ${img.variant.model.castingName} (COL#${img.variant.cardNumber}, Toy#${img.variant.toyNumber || 'empty'})`
    );
    console.log(
      `    Variant.imageId: ${img.variant.imageId}, Image.id: ${img.id} - ${imageIdMatches ? '✓ Match' : '✗ Mismatch'}`
    );
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

