import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`Series#33 İçin Exact Duplicate Kontrolü`);
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
  });

  console.log(`Series#33 içeren modeller: ${allModels.length} adet\n`);

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
    console.log(`⚠️  EXACT DUPLICATE MODELLER BULUNDU:\n`);
    duplicates.forEach(([key, ms]) => {
      const [name, subSeriesId, collectionId] = key.split('|');
      console.log(`  Key: ${name} | SubSeries: ${subSeriesId} | Collection: ${collectionId}`);
      console.log(`  Duplicate sayısı: ${ms.length}\n`);
      
      ms.forEach((m, idx) => {
        console.log(`    ${idx + 1}. Model ID: ${m.id}`);
        console.log(`       SubSeries: ${m.subSeries?.name || 'N/A'} (ID: ${m.subSeriesId})`);
        console.log(`       Variants: ${m.variants.length} adet`);
        m.variants.forEach(v => {
          console.log(`         - ${v.releaseName} (ID: ${v.id})`);
        });
        console.log('');
      });

      // Keep the oldest (lowest ID) and delete others
      const sorted = ms.sort((a, b) => a.id - b.id);
      const keepModel = sorted[0];
      const deleteModels = sorted.slice(1);
      
      console.log(`  ✅ Tutulacak Model: ID ${keepModel.id}`);
      console.log(`  ❌ Silinecek Modeller: ${deleteModels.map(m => `ID ${m.id}`).join(', ')}\n`);
      
      return { keepModel, deleteModels };
    });

    // Ask for confirmation before deleting
    console.log(`\n⚠️  Bu duplicate modelleri silmek istiyor musunuz?`);
    console.log(`   Script'i çalıştırmak için 'yes' yazın ve tekrar çalıştırın.\n`);
  } else {
    console.log(`✅ Exact duplicate model yok.\n`);
    
    // Check if there are models with same casting name but different subSeries
    const byCastingName = new Map<string, typeof allModels>();
    allModels.forEach(m => {
      if (!byCastingName.has(m.castingName)) {
        byCastingName.set(m.castingName, []);
      }
      byCastingName.get(m.castingName)!.push(m);
    });

    const sameNameDifferentSubSeries = Array.from(byCastingName.entries()).filter(([_, ms]) => {
      if (ms.length <= 1) return false;
      const subSeriesIds = new Set(ms.map(m => m.subSeriesId));
      return subSeriesIds.size > 1;
    });

    if (sameNameDifferentSubSeries.length > 0) {
      console.log(`\n⚠️  AYNI CASTING NAME, FARKLI SUBSERIES:\n`);
      sameNameDifferentSubSeries.forEach(([name, ms]) => {
        console.log(`  "${name}" (${ms.length} adet):`);
        ms.forEach((m, idx) => {
          console.log(`    ${idx + 1}. Model ID: ${m.id}, SubSeries: ${m.subSeries?.name || 'N/A'}`);
        });
        console.log('');
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
