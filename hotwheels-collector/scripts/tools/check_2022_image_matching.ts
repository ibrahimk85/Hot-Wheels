import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check2022ImageMatching() {
  console.log('=== Checking 2022 Mainline Image Matching ===\n');

  // Get all 2022 Mainline variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2022,
      model: {
        collection: {
          name: 'Mainline',
          year: {
            year: 2022,
          },
        },
      },
    },
    include: {
      model: true,
    },
  });

  console.log(`Total 2022 Mainline variants: ${variants.length}\n`);

  // Count variants with and without images
  let withImageId = 0;
  let withoutImageId = 0;
  let withImageRecord = 0;
  let withoutImageRecord = 0;

  for (const variant of variants) {
    if (variant.imageId) {
      withImageId++;
      // Check if image record exists
      const imageRecord = await prisma.image.findUnique({
        where: { id: variant.imageId },
      });
      if (imageRecord) {
        withImageRecord++;
      } else {
        withoutImageRecord++;
      }
    } else {
      withoutImageId++;
      withoutImageRecord++;
    }
  }

  console.log(`Variants with imageId: ${withImageId}`);
  console.log(`Variants without imageId: ${withoutImageId}`);
  console.log(`Variants with image record: ${withImageRecord}`);
  console.log(`Variants without image record: ${withoutImageRecord}\n`);

  // Check existing images in the filesystem
  const fs = await import('fs');
  const path = await import('path');
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2022', 'mainline');
  const imageDirExists = fs.existsSync(imageDir);
  
  console.log(`Image directory exists: ${imageDirExists}`);
  if (imageDirExists) {
    const files = fs.readdirSync(imageDir, { recursive: true });
    const imageFiles = files.filter((f) => {
      const fullPath = path.join(imageDir, f as string);
      return fs.statSync(fullPath).isFile() && /\.(jpg|jpeg|png|webp)$/i.test(f as string);
    });
    console.log(`Image files in filesystem: ${imageFiles.length}`);
  }
}

check2022ImageMatching()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








