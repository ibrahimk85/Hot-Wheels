import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const models = await prisma.model.findMany({
    where: {
      castingName: 'Rally Trailer & Ford RS200',
      collection: {
        name: 'Team Transport',
        year: { year: 2021 },
      },
    },
    include: {
      subSeries: true,
      variants: {
        where: {
          cardNumber: '33',
        },
      },
    },
  });

  console.log(`\n"Rally Trailer & Ford RS200" modelleri: ${models.length} adet\n`);
  models.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   SubSeries: ${m.subSeries?.name || 'N/A'} (ID: ${m.subSeriesId})`);
    console.log(`   Variants (Series#33): ${m.variants.length} adet`);
    m.variants.forEach(v => {
      console.log(`     - ${v.releaseName} (ID: ${v.id})`);
    });
    console.log('');
  });

  if (models.length > 1) {
    console.log(`\n⚠️  DUPLICATE MODEL BULUNDU! ${models.length} adet model var.\n`);
    console.log(`En eski modeli tutup diğerlerini sileceğiz.\n`);
    
    // Keep the oldest (lowest ID) and delete others
    const sorted = models.sort((a, b) => a.id - b.id);
    const keepModel = sorted[0];
    const deleteModels = sorted.slice(1);
    
    console.log(`✅ Tutulacak Model: ID ${keepModel.id}`);
    console.log(`❌ Silinecek Modeller: ${deleteModels.map(m => `ID ${m.id}`).join(', ')}\n`);
    
    // Delete duplicate models
    for (const model of deleteModels) {
      // First, delete all variants
      await prisma.variant.deleteMany({
        where: { modelId: model.id },
      });
      
      // Then delete model images
      await prisma.image.deleteMany({
        where: { modelId: model.id },
      });
      
      // Finally delete the model
      await prisma.model.delete({
        where: { id: model.id },
      });
      
      console.log(`✅ Model ID ${model.id} silindi.`);
    }
    
    console.log(`\n✅ Duplicate modeller temizlendi!`);
  } else {
    console.log(`\n✅ Duplicate model yok.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
