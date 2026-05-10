const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating variants for RLC models without variants...\n');

  // Get all RLC collections
  const rlcCollections = await prisma.collection.findMany({
    where: {
      name: 'Red Line Club',
    },
    include: {
      year: true,
      models: {
        include: {
          variants: true,
          subSeries: true,
        },
      },
    },
  });

  let totalVariantsCreated = 0;

  for (const collection of rlcCollections) {
    const year = collection.year.year;
    let variantsCreated = 0;

    for (const model of collection.models) {
      // Check if model already has a variant for this year
      const existingVariant = await prisma.variant.findFirst({
        where: {
          modelId: model.id,
          year: year,
        },
      });

      if (!existingVariant) {
        await prisma.variant.create({
          data: {
            modelId: model.id,
            year: year,
            releaseName: model.subSeries?.name || `Red Line Club ${year}`,
          },
        });
        variantsCreated++;
        console.log(`Created variant for ${model.castingName} (${year})`);
      }
    }

    console.log(`${year}: Created ${variantsCreated} variants`);
    totalVariantsCreated += variantsCreated;
  }

  console.log(`\nTotal variants created: ${totalVariantsCreated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



