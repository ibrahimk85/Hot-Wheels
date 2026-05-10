/**
 * Analyze Boulevard duplicate issue for 2024
 * 
 * Kullanıcının bildirdiği sorun:
 * - 2024'te de duplicate modeller var
 * - Double olanlarda alt seri yok
 * - Resmi ve alt serisi olanlar doğru
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const targetYear = 2024;

async function main() {
  console.log(`=== BOULEVARD ${targetYear} DUPLICATE ANALYSIS ===\n`);

  // Get Boulevard collection
  const boulevardCollection = await prisma.collection.findFirst({
    where: {
      name: 'Boulevard',
      year: { year: targetYear },
    },
    include: {
      subSeries: {
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!boulevardCollection) {
    console.error(`Boulevard ${targetYear} collection not found!`);
    return;
  }

  console.log(`Boulevard Collection ID: ${boulevardCollection.id}`);
  console.log(`Sub-Series: ${boulevardCollection.subSeries.map(s => s.name).join(', ')}\n`);

  // Get all Boulevard models with details
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
        orderBy: { cardNumber: 'asc' },
      },
    },
    orderBy: { castingName: 'asc' },
  });

  console.log(`Total Boulevard ${targetYear} models: ${allModels.length}\n`);

  // Group by castingName
  const byCastingName = new Map<string, typeof allModels>();
  
  for (const model of allModels) {
    const name = model.castingName;
    if (!byCastingName.has(name)) {
      byCastingName.set(name, []);
    }
    byCastingName.get(name)!.push(model);
  }

  // Find duplicates
  const duplicates = Array.from(byCastingName.entries())
    .filter(([_, models]) => models.length > 1)
    .map(([castingName, models]) => ({
      castingName,
      models: models.map(m => ({
        id: m.id,
        subSeries: m.subSeries?.name || 'NO SUB-SERIES',
        subSeriesId: m.subSeriesId,
        variantCount: m.variants.length,
        hasImages: m.variants.some(v => v.imageId !== null || v.images.length > 0),
        variants: m.variants.map(v => ({
          id: v.id,
          cardNumber: v.cardNumber,
          hasImage: v.imageId !== null || v.images.length > 0,
        })),
      })),
    }));

  console.log(`\n=== DUPLICATE CASTING NAMES: ${duplicates.length} ===\n`);

  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      console.log(`\n🔴 ${dup.castingName} (${dup.models.length} models):`);
      
      const withSubSeries = dup.models.filter(m => m.subSeriesId !== null);
      const withoutSubSeries = dup.models.filter(m => m.subSeriesId === null);
      
      console.log(`   With SubSeries: ${withSubSeries.length}`);
      console.log(`   Without SubSeries: ${withoutSubSeries.length}`);
      
      for (const model of dup.models) {
        const status = model.subSeriesId === null ? '❌' : model.hasImages ? '✅' : '⚠️';
        console.log(`   ${status} Model ID ${model.id}: ${model.subSeries}`);
        console.log(`      Variants: ${model.variantCount}, Has Images: ${model.hasImages ? 'YES' : 'NO'}`);
        for (const variant of model.variants) {
          console.log(`        - Card# ${variant.cardNumber} ${variant.hasImage ? '[HAS IMAGE]' : '[NO IMAGE]'}`);
        }
      }
    }
  }

  // Models without subSeries
  const withoutSubSeries = allModels.filter(m => m.subSeriesId === null);
  
  console.log(`\n\n=== MODELS WITHOUT SUB-SERIES: ${withoutSubSeries.length} ===\n`);
  
  if (withoutSubSeries.length > 0) {
    for (const model of withoutSubSeries) {
      const hasImages = model.variants.some(v => v.imageId !== null || v.images.length > 0);
      console.log(`❌ Model ID ${model.id}: ${model.castingName}`);
      console.log(`   Variants: ${model.variants.length}, Has Images: ${hasImages ? 'YES' : 'NO'}`);
      for (const variant of model.variants) {
        const hasImage = variant.imageId !== null || variant.images.length > 0;
        console.log(`   - Card# ${variant.cardNumber} ${hasImage ? '[HAS IMAGE]' : '[NO IMAGE]'}`);
      }
    }
  }

  // Summary statistics
  const modelsWithSubSeries = allModels.filter(m => m.subSeriesId !== null);
  const modelsWithImages = modelsWithSubSeries.filter(m => 
    m.variants.some(v => v.imageId !== null || v.images.length > 0)
  );
  const modelsWithoutImages = modelsWithSubSeries.filter(m => 
    !m.variants.some(v => v.imageId !== null || v.images.length > 0)
  );

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total models: ${allModels.length}`);
  console.log(`  - With SubSeries: ${modelsWithSubSeries.length}`);
  console.log(`  - Without SubSeries: ${withoutSubSeries.length}`);
  console.log(`  - With SubSeries + Images: ${modelsWithImages.length}`);
  console.log(`  - With SubSeries but No Images: ${modelsWithoutImages.length}`);
  console.log(`  - Duplicate casting names: ${duplicates.length}`);

  // Recommendations
  console.log(`\n\n=== RECOMMENDATIONS ===`);
  
  if (withoutSubSeries.length > 0) {
    console.log(`\n🔴 DELETE ${withoutSubSeries.length} models without subSeries:`);
    for (const model of withoutSubSeries) {
      console.log(`   - Model ID ${model.id}: ${model.castingName}`);
      console.log(`     (Will also delete ${model.variants.length} variants)`);
    }
  }

  if (duplicates.length > 0) {
    console.log(`\n🔴 RESOLVE ${duplicates.length} duplicate casting names:`);
    for (const dup of duplicates) {
      const correct = dup.models.find(m => 
        m.subSeriesId !== null && m.hasImages
      ) || dup.models.find(m => m.subSeriesId !== null);
      
      const wrong = dup.models.filter(m => m.id !== correct?.id);
      
      if (correct) {
        console.log(`\n   ✅ Keep: ${dup.castingName} - Model ID ${correct.id} (${correct.subSeries})`);
        for (const w of wrong) {
          console.log(`   ❌ Delete: Model ID ${w.id} (${w.subSeries})`);
        }
      }
    }
  }

  console.log(`\n\nCurrent count: ${allModels.length} models`);
  console.log(`Models with SubSeries: ${modelsWithSubSeries.length}`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




