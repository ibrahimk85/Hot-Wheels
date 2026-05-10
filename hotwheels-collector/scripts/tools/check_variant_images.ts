/**
 * Check if variant images are correctly associated
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Team Transport models from 2018
  const models = await prisma.model.findMany({
    where: {
      subSeries: {
        collection: {
          name: 'Team Transport',
          year: { year: 2018 }
        }
      }
    },
    include: {
      variants: {
        include: {
          images: {
            orderBy: {
              id: 'asc'
            }
          }
        },
        orderBy: {
          id: 'asc'
        }
      }
    },
    take: 3
  });

  if (models.length === 0) {
    console.log('No models found');
    await prisma.$disconnect();
    return;
  }

  for (const model of models) {
    console.log(`\n=== Model: ${model.castingName} ===`);
    console.log(`Variants: ${model.variants.length}`);

    for (const variant of model.variants) {
      console.log(`\nVariant: ${variant.releaseName} (ID: ${variant.id}, Card#: ${variant.cardNumber})`);
      console.log(`  Images: ${variant.images.length}`);
      
      if (variant.images.length === 0) {
        console.log('  ⚠️  No images!');
        continue;
      }
      
      for (const img of variant.images) {
        const isLoose = img.path.toLowerCase().includes('loose-') || 
                       img.path.toLowerCase().includes('_loose') || 
                       img.path.toLowerCase().includes('/loose');
        const isCarded = img.path.toLowerCase().includes('carded-') || 
                        img.path.toLowerCase().includes('_carded') || 
                        img.path.toLowerCase().includes('/carded');
        console.log(`    - ${img.path}`);
        console.log(`      Type: ${isCarded ? 'Carded' : isLoose ? 'Loose' : 'Unknown'}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);


