/**
 * Script to reset all image associations in the database.
 * 
 * This script:
 *   1. Sets all Variant.imageId fields to null
 *   2. Deletes all Image records from the database
 * 
 * This is useful when you need to re-download and re-associate images,
 * for example when upgrading from low-resolution to high-resolution images.
 * 
 * Usage:
 *   npx ts-node scripts/tools/reset_images.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting image associations...');
  
  // Set all Variant.imageId fields to null
  const variantUpdateResult = await prisma.variant.updateMany({
    data: { imageId: null },
  });
  console.log(`✓ Reset imageId for ${variantUpdateResult.count} variants`);
  
  // Delete all Image records
  const imageDeleteResult = await prisma.image.deleteMany({});
  console.log(`✓ Deleted ${imageDeleteResult.count} image records`);
  
  console.log('✅ All image associations and records have been reset.');
  console.log('You can now run the download script to re-download and associate high-resolution images.');
}

main()
  .catch((err) => {
    console.error('Error resetting images:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });













