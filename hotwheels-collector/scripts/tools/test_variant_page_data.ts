/**
 * Script to test what data is returned for Neon Speeders variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getVariants } from '../../src/features/variants/variant.service.js';

const prisma = new PrismaClient();

async function main() {
  const year = 2023;

  console.log('Testing getVariants for Neon Speeders 2023...\n');

  // Find Neon Speeders collection ID
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Neon Speeders',
      year: {
        year: year,
      },
    },
  });

  if (!collection) {
    console.log('Neon Speeders collection not found!');
    return;
  }

  console.log(`Collection ID: ${collection.id}, Name: ${collection.name}\n`);

  const variants = await getVariants({
    year: year,
    collectionId: collection.id,
    limit: 10,
    offset: 0,
  });

  console.log(`Found ${variants.length} variants\n`);

  // Check first 3 variants
  for (const variant of variants.slice(0, 3)) {
    console.log(`\nVariant: ${variant.cardNumber} - ${variant.model?.castingName}`);
    console.log(`  Variant ID: ${variant.id}`);
    console.log(`  imageId: ${variant.imageId}`);
    console.log(`  Images count: ${variant.images?.length || 0}`);
    console.log(`  Collection name: ${variant.model?.subSeries?.collection?.name}`);
    
    if (variant.images && variant.images.length > 0) {
      console.log(`  Images:`);
      variant.images.forEach((img: any) => {
        console.log(`    - ${img.id}: ${img.path} (notes: ${img.notes}, order: ${img.order})`);
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
