import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking Toy# matching for 2019 Mainline...');
  
  // Get variants without images that have color variants
  const variantsWithoutImages = await prisma.variant.findMany({
    where: {
      year: 2019,
      imageId: null,
      color: { not: null },
    },
    include: {
      model: true,
    },
    take: 10,
  });
  
  console.log(`\nVariants without images (with color): ${variantsWithoutImages.length} examples:`);
  variantsWithoutImages.forEach(v => {
    console.log(`  - ${v.model.castingName} (Card #${v.cardNumber}, Color: ${v.color}, Model castingId: ${v.model.castingId})`);
  });
  
  // Check if there are images in the folder for these Toy#
  console.log('\nChecking if images exist in folder for these models...');
  for (const variant of variantsWithoutImages.slice(0, 5)) {
    const modelName = variant.model.castingName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    console.log(`\n${variant.model.castingName} (Color: ${variant.color}):`);
    console.log(`  Model castingId: ${variant.model.castingId}`);
    console.log(`  Expected folder: public/images/hotwheels/2019/mainline/${modelName}/`);
    
    // Get all variants of this model to see their Toy#
    const allVariants = await prisma.variant.findMany({
      where: {
        modelId: variant.modelId,
        year: 2019,
      },
      include: {
        model: true,
      },
    });
    
    console.log(`  All variants of this model:`);
    allVariants.forEach(v => {
      console.log(`    - Card #${v.cardNumber}, Color: ${v.color || 'null'}, Model castingId: ${v.model.castingId}, hasImage: ${v.imageId !== null}`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















