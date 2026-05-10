const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check RLC models and their variants
  const rlcCollections = await prisma.collection.findMany({
    where: {
      name: 'Red Line Club',
    },
    include: {
      year: true,
      models: {
        include: {
          variants: true,
          _count: {
            select: {
              variants: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${rlcCollections.length} RLC collections\n`);
  
  for (const collection of rlcCollections) {
    console.log(`${collection.year.year} - ${collection.models.length} models`);
    
    const modelsWithoutVariants = collection.models.filter(m => m._count.variants === 0);
    const modelsWithVariants = collection.models.filter(m => m._count.variants > 0);
    
    console.log(`  - ${modelsWithVariants.length} models with variants`);
    console.log(`  - ${modelsWithoutVariants.length} models WITHOUT variants\n`);
    
    if (modelsWithoutVariants.length > 0 && modelsWithoutVariants.length <= 5) {
      console.log('  Models without variants:');
      modelsWithoutVariants.forEach(m => {
        console.log(`    - ${m.castingName}`);
      });
      console.log('');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



