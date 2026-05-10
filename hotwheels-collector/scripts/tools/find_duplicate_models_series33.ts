import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`Team Transport Series#33 Duplicate Model Kontrolü`);
  console.log(`========================================\n`);

  // Find all models in Team Transport 2021 that have Series#33 variants
  const models = await prisma.model.findMany({
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
      variants: {
        where: {
          cardNumber: '33',
          year: 2021,
        },
      },
      subSeries: true,
    },
  });

  console.log(`Series#33 içeren Modeller (${models.length} adet):\n`);
  
  models.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Collection ID: ${m.collectionId}`);
    console.log(`   Variants (Series#33): ${m.variants.length} adet`);
    m.variants.forEach(v => {
      console.log(`     - ID: ${v.id}, Release: ${v.releaseName}`);
    });
    console.log('');
  });

  // Check for duplicate casting names
  const castingNames = models.map(m => m.castingName);
  const uniqueNames = new Set(castingNames);
  
  if (castingNames.length !== uniqueNames.size) {
    console.log(`\n⚠️  DUPLICATE MODEL BULUNDU!\n`);
    
    const grouped = new Map<string, typeof models>();
    models.forEach(m => {
      if (!grouped.has(m.castingName)) {
        grouped.set(m.castingName, []);
      }
      grouped.get(m.castingName)!.push(m);
    });

    for (const [name, ms] of grouped.entries()) {
      if (ms.length > 1) {
        console.log(`  "${name}" (${ms.length} adet model):`);
        ms.forEach((m, idx) => {
          console.log(`    ${idx + 1}. Model ID: ${m.id}`);
          console.log(`       SubSeries: ${m.subSeries?.name || 'N/A'}`);
          console.log(`       Variants: ${m.variants.length} adet`);
          m.variants.forEach(v => {
            console.log(`         - ${v.releaseName} (ID: ${v.id})`);
          });
        });
        console.log('');
        
        // Determine which one to keep (usually the one with more variants or lower ID)
        const keepModel = ms.reduce((prev, curr) => {
          if (curr.variants.length > prev.variants.length) return curr;
          if (curr.variants.length < prev.variants.length) return prev;
          return curr.id < prev.id ? curr : prev;
        });
        
        const deleteModels = ms.filter(m => m.id !== keepModel.id);
        
        console.log(`  ✅ Tutulacak Model: ID ${keepModel.id} (${keepModel.variants.length} variant)`);
        console.log(`  ❌ Silinecek Modeller: ${deleteModels.map(m => `ID ${m.id}`).join(', ')}\n`);
        
        return { keepModel, deleteModels };
      }
    }
  } else {
    console.log(`\n✅ Duplicate model yok.`);
    console.log(`\nAma arayüzde iki kez gösteriliyorsa, başka bir neden olabilir.`);
    console.log(`Model sayısı: ${models.length}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
