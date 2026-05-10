import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n========================================`);
  console.log(`TÜM Series#33 Modelleri (Her Yerde)`);
  console.log(`========================================\n`);

  // Find ALL models that have ANY variant with cardNumber 33 in 2021
  const allModels = await prisma.model.findMany({
    where: {
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
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
      collection: {
        include: {
          year: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log(`TÜM Series#33 Modelleri (${allModels.length} adet):\n`);
  
  allModels.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries ID: ${m.subSeriesId}`);
    console.log(`   SubSeries Name: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Collection ID: ${m.collectionId}`);
    console.log(`   Collection Name: ${m.collection.name}`);
    console.log(`   Year: ${m.collection.year.year}`);
    console.log(`   Variants (Series#33): ${m.variants.length} adet`);
    m.variants.forEach(v => {
      console.log(`     - ID: ${v.id}, Release: ${v.releaseName}`);
    });
    console.log('');
  });

  // Group by casting name
  const groupedByName = new Map<string, typeof allModels>();
  allModels.forEach(m => {
    if (!groupedByName.has(m.castingName)) {
      groupedByName.set(m.castingName, []);
    }
    groupedByName.get(m.castingName)!.push(m);
  });

  const duplicates = Array.from(groupedByName.entries()).filter(([_, ms]) => ms.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  AYNI CASTING NAME'E SAHİP BİRDEN FAZLA MODEL:\n`);
    duplicates.forEach(([name, ms]) => {
      console.log(`  "${name}" (${ms.length} adet):`);
      ms.forEach((m, idx) => {
        console.log(`    ${idx + 1}. Model ID: ${m.id}`);
        console.log(`       SubSeries: ${m.subSeries?.name || 'N/A'} (ID: ${m.subSeriesId})`);
        console.log(`       Collection: ${m.collection.name} (ID: ${m.collectionId})`);
        console.log(`       Year: ${m.collection.year.year}`);
        console.log(`       Variants: ${m.variants.length} adet`);
      });
      console.log('');
    });
  } else {
    console.log(`\n✅ Aynı casting name'e sahip duplicate model yok.`);
  }

  // Check specifically for "Rally Trailer & Ford RS200"
  const rallyModels = allModels.filter(m => m.castingName.includes('Rally Trailer') && m.castingName.includes('Ford RS200'));
  if (rallyModels.length > 1) {
    console.log(`\n⚠️  "Rally Trailer & Ford RS200" için ${rallyModels.length} model bulundu!\n`);
    rallyModels.forEach((m, idx) => {
      console.log(`  ${idx + 1}. Model ID: ${m.id}`);
      console.log(`     Casting Name: ${m.castingName}`);
      console.log(`     SubSeries: ${m.subSeries?.name || 'N/A'}`);
      console.log(`     Collection: ${m.collection.name}`);
      console.log(`     Year: ${m.collection.year.year}`);
      console.log('');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
