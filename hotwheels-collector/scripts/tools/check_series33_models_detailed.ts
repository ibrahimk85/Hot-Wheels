import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`Team Transport 2021 Series#33 Detaylı Kontrol`);
  console.log(`========================================\n`);

  // Get all models in Team Transport 2021
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
      collection: {
        include: {
          year: true,
        },
      },
    },
  });

  console.log(`Series#33 içeren Modeller (${models.length} adet):\n`);
  
  models.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries ID: ${m.subSeriesId}`);
    console.log(`   SubSeries Name: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Collection ID: ${m.collectionId}`);
    console.log(`   Collection Name: ${m.collection.name}`);
    console.log(`   Year: ${m.collection.year.year}`);
    console.log(`   Variants (Series#33): ${m.variants.length} adet`);
    m.variants.forEach(v => {
      console.log(`     - ID: ${v.id}, Release: ${v.releaseName}, Card#: ${v.cardNumber}`);
    });
    console.log('');
  });

  // Check if getModels would return duplicates
  console.log(`\n========================================`);
  console.log(`getModels() Simülasyonu`);
  console.log(`========================================\n`);

  const simulatedModels = await prisma.model.findMany({
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

  // Filter models that have Series#33
  const modelsWithSeries33 = simulatedModels.filter(m => 
    m.variants.some(v => v.cardNumber === '33')
  );

  console.log(`getModels() ile Series#33 içeren modeller: ${modelsWithSeries33.length} adet\n`);
  modelsWithSeries33.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Variants with Series#33: ${m.variants.filter(v => v.cardNumber === '33').length}`);
    console.log('');
  });

  // Check for exact duplicates (same castingName, same subSeries, same collection, same year)
  const seen = new Map<string, number[]>();
  modelsWithSeries33.forEach(m => {
    const key = `${m.castingName}_${m.subSeriesId}_${m.collectionId}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(m.id);
  });

  const duplicates = Array.from(seen.entries()).filter(([_, ids]) => ids.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  DUPLICATE MODELLER BULUNDU:\n`);
    duplicates.forEach(([key, ids]) => {
      console.log(`  Key: ${key}`);
      console.log(`  Duplicate Model IDs: ${ids.join(', ')}`);
      ids.forEach(id => {
        const m = modelsWithSeries33.find(m => m.id === id);
        if (m) {
          console.log(`    - Model ID ${id}: ${m.castingName} (SubSeries: ${m.subSeries?.name || 'N/A'})`);
        }
      });
      console.log('');
    });
  } else {
    console.log(`\n✅ getModels() seviyesinde duplicate yok.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
