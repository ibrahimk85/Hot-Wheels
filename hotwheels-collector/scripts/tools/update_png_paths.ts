import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function updatePngPaths() {
  // Find all images with mazda-mx-5-miata that have .jpg extension
  const images = await prisma.image.findMany({
    where: {
      path: {
        contains: 'mazda-mx-5-miata',
      },
    },
  });

  console.log(`Found ${images.length} images for mazda-mx-5-miata\n`);

  let updated = 0;
  for (const img of images) {
    const dbPath = img.path;
    
    // Check if path ends with .jpg
    if (dbPath.endsWith('.jpg') || dbPath.endsWith('.jpeg')) {
      const newPath = dbPath.replace(/\.(jpg|jpeg)$/i, '.png');
      const fullPath = path.join(process.cwd(), 'public', newPath);
      
      // Check if .png file exists
      if (fs.existsSync(fullPath)) {
        console.log(`Updating: ${dbPath} → ${newPath}`);
        await prisma.image.update({
          where: { id: img.id },
          data: { path: newPath },
        });
        updated++;
        console.log(`  ✓ Updated!`);
      } else {
        console.log(`  ✗ PNG file not found at: ${fullPath}`);
      }
    }
  }

  console.log(`\nTotal updated: ${updated}`);
  await prisma.$disconnect();
}

updatePngPaths().catch(console.error);








