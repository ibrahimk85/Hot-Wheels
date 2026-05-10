/**
 * Detailed check for variant images
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a specific Team Transport model from 2018
  const model = await prisma.model.findFirst({
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
    }
  });

  if (!model) {
    console.log('No model found');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== Model: ${model.castingName} (ID: ${model.id}) ===`);
  console.log(`Variants: ${model.variants.length}\n`);

  for (const variant of model.variants) {
    console.log(`Variant: ${variant.releaseName}`);
    console.log(`  ID: ${variant.id}`);
    console.log(`  Card#: ${variant.cardNumber}`);
    console.log(`  Year: ${variant.year}`);
    console.log(`  Images count: ${variant.images.length}`);
    
    if (variant.images.length === 0) {
      console.log('  ⚠️  NO IMAGES!');
    } else {
      for (const img of variant.images) {
        const isLoose = img.path.toLowerCase().includes('loose-') || 
                       img.path.toLowerCase().includes('_loose') || 
                       img.path.toLowerCase().includes('/loose');
        const isCarded = img.path.toLowerCase().includes('carded-') || 
                        img.path.toLowerCase().includes('_carded') || 
                        img.path.toLowerCase().includes('/carded');
        console.log(`    - Image ID: ${img.id}`);
        console.log(`      Path: ${img.path}`);
        console.log(`      Type: ${isCarded ? 'Carded' : isLoose ? 'Loose' : 'Unknown'}`);
      }
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error);


