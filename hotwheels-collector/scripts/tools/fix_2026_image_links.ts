import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing 2026 Mainline image links...\n');

  // Find all variants without imageId but with images
  const variantsWithoutImageId = await prisma.variant.findMany({
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
    include: {
      images: {
        orderBy: {
          id: 'asc',
        },
        take: 1,
      },
      model: {
        select: {
          castingName: true,
        },
      },
    },
  });

  console.log(`Found ${variantsWithoutImageId.length} variants without imageId but with images\n`);

  let fixedCount = 0;
  for (const variant of variantsWithoutImageId) {
    if (variant.images.length > 0) {
      const firstImage = variant.images[0];
      await prisma.variant.update({
        where: { id: variant.id },
        data: { imageId: firstImage.id },
      });
      fixedCount++;
      if (fixedCount <= 10) {
        console.log(
          `Fixed: ${variant.model.castingName} (COL#${variant.cardNumber}, Toy#${variant.toyNumber || 'empty'}) → Image ID: ${firstImage.id}`
        );
      }
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} variants`);

  // Also check for variants with imageId but the image doesn't exist or is not linked
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
    include: {
      images: true,
    },
  });

  let brokenCount = 0;
  for (const variant of variantsWithImageId) {
    const imageExists = variant.images.some(img => img.id === variant.imageId);
    if (!imageExists && variant.imageId) {
      // Check if image exists in database
      const image = await prisma.image.findUnique({
        where: { id: variant.imageId },
        select: { id: true, variantId: true },
      });

      if (!image) {
        console.warn(`Variant ${variant.id} has imageId ${variant.imageId} but image doesn't exist`);
        // Clear the imageId
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageId: null },
        });
        brokenCount++;
      } else if (image.variantId !== variant.id) {
        console.warn(`Variant ${variant.id} has imageId ${variant.imageId} but image belongs to variant ${image.variantId}`);
        // Try to find correct image
        if (variant.images.length > 0) {
          await prisma.variant.update({
            where: { id: variant.id },
            data: { imageId: variant.images[0].id },
          });
          brokenCount++;
        }
      }
    }
  }

  if (brokenCount > 0) {
    console.log(`\n✅ Fixed ${brokenCount} broken image links`);
  }

  // Final count
  const finalCount = await prisma.variant.count({
    where: {
      year: 2026,
      imageId: { not: null },
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  });

  console.log(`\n📊 Final count: ${finalCount} variants with imageId`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });









