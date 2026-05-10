import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Updating all .jpg/.jpeg paths to .png for mazda-mx-5-miata...\n');
    
    // Update all images with mazda-mx-5-miata that have .jpg or .jpeg extension
    const result = await prisma.$executeRaw`
      UPDATE Image 
      SET path = REPLACE(REPLACE(path, '.jpg', '.png'), '.jpeg', '.png')
      WHERE path LIKE '%mazda-mx-5-miata%' 
        AND (path LIKE '%.jpg' OR path LIKE '%.jpeg')
    `;
    
    console.log(`Updated ${result} image paths`);
    
    // Show updated paths
    const updated = await prisma.image.findMany({
      where: {
        path: {
          contains: 'mazda-mx-5-miata',
        },
      },
    });
    
    console.log('\nUpdated paths:');
    updated.forEach(img => {
      console.log(`  ${img.path}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();








