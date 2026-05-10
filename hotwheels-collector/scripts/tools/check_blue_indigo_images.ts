/**
 * Script to check Blue Indigo variant images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASTING_NAME = "'21 Pagani Huayra R";
const TARGET_COLOR = 'Spectraflame Blue Indigo';
const TARGET_YEAR = 2024;

async function main() {
  try {
    // Find model
    const yearRecord = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
    if (!yearRecord) {
      throw new Error(`Year ${TARGET_YEAR} not found`);
    }

    const collectionRecord = await prisma.collection.findFirst({
      where: {
        name: 'Red Line Club',
        yearId: yearRecord.id,
      },
    });

    if (!collectionRecord) {
      throw new Error('Collection not found');
    }

    const model = await prisma.model.findFirst({
      where: {
        castingName: CASTING_NAME,
        collectionId: collectionRecord.id,
      },
    });

    if (!model) {
      throw new Error('Model not found');
    }

    console.log(`Model: ${model.castingName} (ID: ${model.id})\n`);

    // Get all variants
    const variants = await prisma.variant.findMany({
      where: {
        modelId: model.id,
        year: TARGET_YEAR,
      },
      include: {
        images: true,
      },
    });

    console.log(`Found ${variants.length} variants:\n`);

    for (const variant of variants) {
      console.log(`Variant ID: ${variant.id}`);
      console.log(`  Color: ${variant.color}`);
      console.log(`  Variant-level images: ${variant.images.length}`);
      variant.images.forEach(img => {
        console.log(`    - ${img.path} (ID: ${img.id})`);
      });
      console.log('');
    }

    // Get model-level images
    const modelImages = await prisma.image.findMany({
      where: {
        modelId: model.id,
        variantId: null, // Model-level images
      },
    });

    console.log(`Model-level images: ${modelImages.length}`);
    modelImages.forEach(img => {
      console.log(`  - ${img.path} (ID: ${img.id})`);
    });

    // Check Blue Indigo specifically
    const blueIndigoVariant = variants.find(v => 
      v.color && v.color.toLowerCase().includes('blue indigo')
    );

    if (blueIndigoVariant) {
      console.log(`\n=== Blue Indigo Variant (ID: ${blueIndigoVariant.id}) ===`);
      console.log(`Variant-level images: ${blueIndigoVariant.images.length}`);
      if (blueIndigoVariant.images.length === 0) {
        console.log('⚠️  WARNING: Blue Indigo variant has no variant-level images!');
        console.log('   It will fall back to model-level images (which may include Slate images)');
      } else {
        console.log('✅ Blue Indigo has variant-specific images:');
        blueIndigoVariant.images.forEach(img => {
          console.log(`   - ${img.path}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();







