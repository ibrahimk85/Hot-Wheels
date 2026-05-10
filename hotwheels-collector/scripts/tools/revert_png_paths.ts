import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Reverting .png paths back to .jpg for mazda-mx-5-miata...\n');
    
    // First, show what will be reverted
    const imagesToRevert = await prisma.image.findMany({
      where: {
        path: {
          contains: 'mazda-mx-5-miata',
        },
      },
    });
    
    console.log(`Found ${imagesToRevert.length} images to check\n`);
    
    let reverted = 0;
    for (const img of imagesToRevert) {
      if (img.path.endsWith('.png')) {
        const newPath = img.path.replace(/\.png$/, '.jpg');
        console.log(`Reverting: ${img.path} → ${newPath}`);
        
        await prisma.image.update({
          where: { id: img.id },
          data: { path: newPath },
        });
        
        reverted++;
        console.log('  ✓ Reverted!\n');
      }
    }
    
    console.log(`\nTotal reverted: ${reverted} image paths`);
    
    // Show final paths
    const final = await prisma.image.findMany({
      where: {
        path: {
          contains: 'mazda-mx-5-miata',
        },
      },
    });
    
    console.log('\nFinal paths:');
    final.forEach(img => {
      console.log(`  ${img.path}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







