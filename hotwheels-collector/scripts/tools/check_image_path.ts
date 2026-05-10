import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function checkImagePaths() {
  const images = await prisma.image.findMany({
    where: {
      path: {
        contains: 'mazda-mx-5-miata',
      },
    },
  });

  console.log(`Found ${images.length} images for mazda-mx-5-miata\n`);

  for (const img of images) {
    const fullPath = path.join(process.cwd(), 'public', img.path);
    const exists = fs.existsSync(fullPath);
    
    console.log(`Image ID: ${img.id}`);
    console.log(`Path in DB: ${img.path}`);
    console.log(`Full path: ${fullPath}`);
    console.log(`File exists: ${exists}`);
    
    if (!exists) {
      // Try with different extensions
      const basePath = fullPath.replace(/\.(jpg|jpeg|png|gif)$/i, '');
      const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
      
      for (const ext of extensions) {
        const testPath = basePath + ext;
        if (fs.existsSync(testPath)) {
          console.log(`✓ Found with extension: ${ext}`);
          console.log(`  Should update DB path to: ${img.path.replace(/\.(jpg|jpeg|png|gif)$/i, ext)}`);
        }
      }
    }
    console.log('---\n');
  }

  await prisma.$disconnect();
}

checkImagePaths().catch(console.error);








