import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`Series#33 Duplicate Temizleme`);
  console.log(`========================================\n`);

  // Find ALL models with Series#33 in Team Transport 2021
  const allModels = await prisma.model.findMany({
    where: {
      collection: {
        name: 'Team Transport',
        year: { year: 2021 },
      },
      variants: {
        some: {
          cardNumber: '33',
          year: 2021,
        },
      },
    },
    include: {
      subSeries: true,
      variants: {
        where: {
          cardNumber: '33',
          year: 2021,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log(`Series#33 içeren modeller: ${allModels.length} adet\n`);

  if (allModels.length === 0) {
    console.log(`❌ Series#33 için model bulunamadı!`);
    return;
  }

  // Group by exact match: castingName + subSeriesId + collectionId
  const exactMatches = new Map<string, typeof allModels>();
  allModels.forEach(m => {
    const key = `${m.castingName}|${m.subSeriesId}|${m.collectionId}`;
    if (!exactMatches.has(key)) {
      exactMatches.set(key, []);
    }
    exactMatches.get(key)!.push(m);
  });

  const duplicates = Array.from(exactMatches.entries()).filter(([_, ms]) => ms.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️  DUPLICATE MODELLER BULUNDU:\n`);
    
    for (const [key, ms] of duplicates) {
      const [name, subSeriesId, collectionId] = key.split('|');
      console.log(`  "${name}" (${ms.length} adet):`);
      
      // Keep the oldest (lowest ID) and delete others
      const sorted = ms.sort((a, b) => a.id - b.id);
      const keepModel = sorted[0];
      const deleteModels = sorted.slice(1);
      
      console.log(`    ✅ Tutulacak: Model ID ${keepModel.id}`);
      console.log(`    ❌ Silinecek: ${deleteModels.map(m => `Model ID ${m.id}`).join(', ')}\n`);
      
      // Delete duplicate models
      for (const model of deleteModels) {
        console.log(`  Siliniyor: Model ID ${model.id}...`);
        
        // Delete all variant images
        for (const variant of model.variants) {
          await prisma.image.deleteMany({
            where: { variantId: variant.id },
          });
        }
        
        // Delete all variants
        await prisma.variant.deleteMany({
          where: { modelId: model.id },
        });
        
        // Delete model images
        await prisma.image.deleteMany({
          where: { modelId: model.id },
        });
        
        // Finally delete the model
        await prisma.model.delete({
          where: { id: model.id },
        });
        
        console.log(`    ✅ Model ID ${model.id} silindi.`);
      }
    }
    
    console.log(`\n✅ Duplicate modeller temizlendi!`);
  } else {
    console.log(`✅ Duplicate model yok.\n`);
    
    // If no duplicates in DB, the issue might be in the UI
    // Check if there are any models that might be causing issues
    if (allModels.length === 1) {
      const model = allModels[0];
      console.log(`Tek model bulundu:`);
      console.log(`  Model ID: ${model.id}`);
      console.log(`  Casting Name: ${model.castingName}`);
      console.log(`  SubSeries: ${model.subSeries?.name || 'N/A'}`);
      console.log(`  Variants: ${model.variants.length} adet\n`);
      
      console.log(`⚠️  Veritabanında duplicate yok, ama arayüzde iki kez gösteriliyor.`);
      console.log(`   Bu durumda sorun muhtemelen:`);
      console.log(`   1. Arayüz cache sorunu (sayfayı yenileyin)`);
      console.log(`   2. React key problemi (ama key={model.id} kullanılıyor)`);
      console.log(`   3. getModels() fonksiyonu aynı modeli iki kez döndürüyor\n`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
