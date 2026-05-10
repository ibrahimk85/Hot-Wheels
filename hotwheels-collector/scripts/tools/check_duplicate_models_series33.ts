import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all models that have Series#33 variants
  const models = await prisma.model.findMany({
    where: {
      variants: {
        some: {
          year: 2021,
          cardNumber: '33',
          model: {
            collection: {
              name: 'Team Transport',
            },
          },
        },
      },
    },
    include: {
      variants: {
        where: {
          year: 2021,
          cardNumber: '33',
        },
      },
      subSeries: true,
    },
  });

  console.log(`\nSeries#33 içeren Modeller (${models.length} adet):\n`);
  models.forEach((m, idx) => {
    console.log(`${idx + 1}. Model ID: ${m.id}`);
    console.log(`   Casting Name: ${m.castingName}`);
    console.log(`   SubSeries: ${m.subSeries?.name || 'N/A'}`);
    console.log(`   Variants: ${m.variants.length} adet`);
    m.variants.forEach(v => {
      console.log(`     - ${v.releaseName} (ID: ${v.id})`);
    });
    console.log('');
  });

  if (models.length > 1) {
    console.log(`\n⚠️  Birden fazla model bulundu! Bu duplicate olabilir.\n`);
    
    // Check if they have the same casting name
    const castingNames = models.map(m => m.castingName);
    const uniqueNames = new Set(castingNames);
    
    if (castingNames.length !== uniqueNames.size) {
      console.log(`❌ Aynı casting name'e sahip birden fazla model var!\n`);
      
      const grouped = new Map<string, typeof models>();
      models.forEach(m => {
        if (!grouped.has(m.castingName)) {
          grouped.set(m.castingName, []);
        }
        grouped.get(m.castingName)!.push(m);
      });

      for (const [name, ms] of grouped.entries()) {
        if (ms.length > 1) {
          console.log(`  "${name}" (${ms.length} adet):`);
          ms.forEach(m => {
            console.log(`    - Model ID: ${m.id}, SubSeries: ${m.subSeries?.name || 'N/A'}, Variants: ${m.variants.length}`);
          });
          console.log('');
        }
      }
    }
  } else {
    console.log(`\n✅ Sadece bir model bulundu.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
