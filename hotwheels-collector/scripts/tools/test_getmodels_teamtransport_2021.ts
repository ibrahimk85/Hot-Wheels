import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`Team Transport 2021 Modelleri`);
  console.log(`========================================\n`);

  // Simulate getModels() query
  const models = await prisma.model.findMany({
    where: {
      collection: {
        name: 'Team Transport',
        year: { year: 2021 },
      },
    },
    include: {
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
      variants: {
        select: {
          id: true,
          cardNumber: true,
          color: true,
          toyNumber: true,
        },
        take: 10,
      },
    },
    orderBy: {
      castingName: 'asc',
    },
  });

  console.log(`Toplam model sayısı: ${models.length}\n`);

  // Group by model ID to find duplicates
  const modelIds = new Map<number, number>();
  models.forEach(m => {
    modelIds.set(m.id, (modelIds.get(m.id) || 0) + 1);
  });

  const duplicates = Array.from(modelIds.entries()).filter(([_, count]) => count > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️  DUPLICATE MODEL ID'LER BULUNDU:\n`);
    duplicates.forEach(([id, count]) => {
      const model = models.find(m => m.id === id);
      console.log(`  Model ID: ${id} (${count} kez)`);
      console.log(`    Casting Name: ${model?.castingName}`);
      console.log(`    SubSeries: ${model?.subSeries?.name || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log(`✅ Duplicate model ID yok.\n`);
  }

  // Check for Series#33
  const series33Models = models.filter(m => 
    m.variants.some(v => v.cardNumber === '33')
  );

  console.log(`Series#33 içeren modeller: ${series33Models.length} adet\n`);
  series33Models.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Variants with Series#33: ${m.variants.filter(v => v.cardNumber === '33').length}`);
    console.log('');
  });

  // Check for exact duplicate casting names
  const castingNames = new Map<string, typeof models>();
  models.forEach(m => {
    if (!castingNames.has(m.castingName)) {
      castingNames.set(m.castingName, []);
    }
    castingNames.get(m.castingName)!.push(m);
  });

  const duplicateNames = Array.from(castingNames.entries()).filter(([_, ms]) => ms.length > 1);
  
  if (duplicateNames.length > 0) {
    console.log(`\n⚠️  AYNI CASTING NAME'E SAHİP MODELLER:\n`);
    duplicateNames.forEach(([name, ms]) => {
      console.log(`  "${name}" (${ms.length} adet):`);
      ms.forEach((m, idx) => {
        console.log(`    ${idx + 1}. Model ID: ${m.id}, SubSeries: ${m.subSeries?.name || 'N/A'}`);
      });
      console.log('');
    });
  } else {
    console.log(`\n✅ Aynı casting name'e sahip duplicate model yok.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
