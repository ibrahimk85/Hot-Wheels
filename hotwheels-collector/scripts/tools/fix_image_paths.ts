import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function fixImagePaths() {
  // Find all images with HYW18_001
  const images = await prisma.image.findMany({
    where: {
      path: {
        contains: 'HYW18_001',
      },
    },
  });

  console.log(`Found ${images.length} images with HYW18_001\n`);

  for (const img of images) {
    const dbPath = img.path;
    const fullPath = path.join(process.cwd(), 'public', dbPath);
    
    console.log(`Checking: ${dbPath}`);
    
    // Check if file exists with current path
    if (fs.existsSync(fullPath)) {
      console.log(`✓ File exists at: ${fullPath}`);
      continue;
    }
    
    // Try different extensions
    const basePath = fullPath.replace(/\.(jpg|jpeg|png|gif)$/i, '');
    const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
    
    let found = false;
    for (const ext of extensions) {
      const testPath = basePath + ext;
      if (fs.existsSync(testPath)) {
        const newDbPath = dbPath.replace(/\.(jpg|jpeg|png|gif)$/i, ext);
        console.log(`✗ File not found, but found with extension ${ext}`);
        console.log(`  Updating DB path from: ${dbPath}`);
        console.log(`  To: ${newDbPath}`);
        
        await prisma.image.update({
          where: { id: img.id },
          data: { path: newDbPath },
        });
        
        console.log(`  ✓ Updated!\n`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`✗ File not found with any extension\n`);
    }
  }

  await prisma.$disconnect();
}

fixImagePaths().catch(console.error);








