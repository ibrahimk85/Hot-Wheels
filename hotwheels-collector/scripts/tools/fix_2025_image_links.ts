import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function fix2025ImageLinks() {
  console.log('=== Fixing 2025 Mainline Image Links ===\n');

  // Get all 2025 Mainline variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2025,
      model: {
        collection: {
          name: 'Mainline',
          year: {
            year: 2025,
          },
        },
      },
    },
    include: {
      model: true,
    },
  });

  console.log(`Total variants: ${variants.length}\n`);

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2025', 'mainline');
  let fixedCount = 0;
  let alreadyLinkedCount = 0;
  let noImageCount = 0;
  let noToyNumberCount = 0;

  for (const variant of variants) {
    // Skip if no toyNumber
    if (!variant.toyNumber || variant.toyNumber.trim() === '') {
      noToyNumberCount++;
      continue;
    }

    // Skip if already has imageId
    if (variant.imageId) {
      // Verify the image record exists
      const existingImage = await prisma.image.findUnique({
        where: { id: variant.imageId },
      });
      if (existingImage) {
        alreadyLinkedCount++;
        continue;
      }
      // Image record doesn't exist, so we need to fix it
    }

    // Find image file by toyNumber
    const toyNumber = variant.toyNumber.trim();
    let imageFile: string | null = null;

    // Search in all subdirectories
    if (fs.existsSync(baseDir)) {
      const subdirs = fs.readdirSync(baseDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const subdir of subdirs) {
        const subdirPath = path.join(baseDir, subdir);
        const files = fs.readdirSync(subdirPath);
        const matchingFile = files.find(f => {
          const nameWithoutExt = path.parse(f).name;
          return nameWithoutExt === toyNumber;
        });
        if (matchingFile) {
          imageFile = path.join(subdir, matchingFile);
          break;
        }
      }
    }

    if (!imageFile) {
      noImageCount++;
      continue;
    }

    // Create or find Image record
    const relativePath = path.join('/images', 'hotwheels', '2025', 'mainline', imageFile)
      .replace(/\\/g, '/');

    let imageRecord = await prisma.image.findFirst({
      where: {
        path: relativePath,
      },
    });

    if (!imageRecord) {
      imageRecord = await prisma.image.create({
        data: {
          path: relativePath,
          alt: variant.model.castingName,
          variant: { connect: { id: variant.id } },
        },
      });
    }

    // Update variant's imageId
    await prisma.variant.update({
      where: { id: variant.id },
      data: { imageId: imageRecord.id },
    });

    fixedCount++;
    console.log(`Fixed: ${variant.model.castingName} (Toy#: ${toyNumber})`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Already linked: ${alreadyLinkedCount}`);
  console.log(`No image file found: ${noImageCount}`);
  console.log(`No Toy#: ${noToyNumberCount}`);
}

fix2025ImageLinks()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








