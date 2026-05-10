import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Searching for images with HYW18_001...');
    
    const images = await prisma.image.findMany({
      where: {
        path: {
          contains: 'HYW18_001',
        },
      },
    });

    console.log(`Found ${images.length} images\n`);

    for (const img of images) {
      console.log(`Current path: ${img.path}`);
      
      if (img.path.endsWith('.jpg') || img.path.endsWith('.jpeg')) {
        const newPath = img.path.replace(/\.(jpg|jpeg)$/i, '.png');
        console.log(`Updating to: ${newPath}`);
        
        await prisma.image.update({
          where: { id: img.id },
          data: { path: newPath },
        });
        
        console.log('✓ Updated!\n');
      } else {
        console.log('No update needed\n');
      }
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();








