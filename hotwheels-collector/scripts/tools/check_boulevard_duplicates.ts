/**
 * Script to check for duplicate Boulevard models and variants in the database
 * 
 * This script identifies:
 * 1. Duplicate models (same castingName but different subSeriesId or NULL subSeriesId)
 * 2. Duplicate variants (same model but different cardNumber or missing subSeries)
 * 3. Models without subSeries (which should have Mix1-Mix5)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const targetYear = 2025;

async function main() {
  console.log('=== BOULEVARD DUPLICATE CHECK ===\n');

  // Get Boulevard collection
  const boulevardCollection = await prisma.collection.findFirst({
    where: {
      name: 'Boulevard',
      year: { year: targetYear },
    },
    include: {
      subSeries: true,
    },
  });

  if (!boulevardCollection) {
    console.error('Boulevard collection not found!');
    return;
  }

  console.log(`Found Boulevard collection with ${boulevardCollection.subSeries.length} sub-series:`);
  boulevardCollection.subSeries.forEach(sub => {
    console.log(`  - ${sub.name} (ID: ${sub.id})`);
  });

  // Get all Boulevard models
  const allModels = await prisma.model.findMany({
    where: {
      collectionId: boulevardCollection.id,
    },
    include: {
      subSeries: true,
      variants: {
        include: {
          images: true,
        },
      },
    },
  });

  console.log(`\nTotal Boulevard models: ${allModels.length}`);
  console.log(`Expected: 25 models (5 Mix × 5 models each)\n`);

  // Group models by castingName
  const modelsByName = new Map<string, typeof allModels>();
  
  for (const model of allModels) {
    const name = model.castingName;
    if (!modelsByName.has(name)) {
      modelsByName.set(name, []);
    }
    modelsByName.get(name)!.push(model);
  }

  // Find duplicates
  const duplicates: Array<{
    castingName: string;
    models: typeof allModels;
    hasSubSeries: number;
    noSubSeries: number;
  }> = [];

  for (const [castingName, models] of modelsByName.entries()) {
    if (models.length > 1) {
      const withSubSeries = models.filter(m => m.subSeriesId !== null);
      const withoutSubSeries = models.filter(m => m.subSeriesId === null);
      
      duplicates.push({
        castingName,
        models,
        hasSubSeries: withSubSeries.length,
        noSubSeries: withoutSubSeries.length,
      });
    }
  }

  // Find models without subSeries
  const modelsWithoutSubSeries = allModels.filter(m => m.subSeriesId === null);

  console.log(`\n=== DUPLICATE ANALYSIS ===\n`);
  console.log(`Duplicate casting names found: ${duplicates.length}`);
  console.log(`Models without subSeries: ${modelsWithoutSubSeries.length}\n`);

  if (duplicates.length > 0) {
    console.log('DUPLICATE MODELS:');
    console.log('='.repeat(80));
    
    for (const dup of duplicates) {
      console.log(`\n📦 ${dup.castingName} (${dup.models.length} models)`);
      console.log(`   With subSeries: ${dup.hasSubSeries}, Without subSeries: ${dup.noSubSeries}`);
      
      for (const model of dup.models) {
        const subSeriesName = model.subSeries?.name || 'NO SUB-SERIES';
        const variantCount = model.variants.length;
        const hasImages = model.variants.some(v => v.images.length > 0 || v.imageId !== null);
        
        console.log(`   - Model ID: ${model.id}, SubSeries: ${subSeriesName}, Variants: ${variantCount}, Has Images: ${hasImages ? 'YES' : 'NO'}`);
        
        // Show variant details
        for (const variant of model.variants) {
          const imageInfo = variant.imageId ? `[Image ID: ${variant.imageId}]` : '[No Image]';
          console.log(`     Variant ID: ${variant.id}, Card#: ${variant.cardNumber}, Year: ${variant.year} ${imageInfo}`);
        }
      }
    }
  }

  if (modelsWithoutSubSeries.length > 0) {
    console.log('\n\nMODELS WITHOUT SUB-SERIES:');
    console.log('='.repeat(80));
    
    for (const model of modelsWithoutSubSeries) {
      const hasImages = model.variants.some(v => v.images.length > 0 || v.imageId !== null);
      console.log(`- ${model.castingName} (ID: ${model.id}) - Variants: ${model.variants.length}, Has Images: ${hasImages ? 'YES' : 'NO'}`);
      
      for (const variant of model.variants) {
        const imageInfo = variant.imageId ? `[Image ID: ${variant.imageId}]` : '[No Image]';
        console.log(`  Variant ID: ${variant.id}, Card#: ${variant.cardNumber} ${imageInfo}`);
      }
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`Total models: ${allModels.length}`);
  console.log(`Expected: 25`);
  console.log(`Duplicate casting names: ${duplicates.length}`);
  console.log(`Models without subSeries: ${modelsWithoutSubSeries.length}`);
  console.log(`Models with subSeries: ${allModels.length - modelsWithoutSubSeries.length}`);

  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  
  if (duplicates.length > 0) {
    console.log('\n🔴 DUPLICATES FOUND:');
    for (const dup of duplicates) {
      const correctModel = dup.models.find(m => m.subSeriesId !== null && m.variants.some(v => v.imageId !== null || v.images.length > 0));
      const wrongModels = dup.models.filter(m => m.id !== correctModel?.id);
      
      if (correctModel && wrongModels.length > 0) {
        console.log(`\n✅ Keep: ${dup.castingName} - Model ID ${correctModel.id} (${correctModel.subSeries?.name})`);
        console.log(`❌ Delete: ${wrongModels.map(m => `Model ID ${m.id}`).join(', ')}`);
      }
    }
  }
  
  if (modelsWithoutSubSeries.length > 0) {
    console.log('\n🔴 MODELS WITHOUT SUB-SERIES (should be deleted):');
    for (const model of modelsWithoutSubSeries) {
      console.log(`   - Model ID ${model.id}: ${model.castingName}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




