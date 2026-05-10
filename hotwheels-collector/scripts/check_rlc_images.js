const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check RLC 2025 images
  const images = await prisma.image.findMany({
    where: {
      path: {
        contains: '/2025/rlc/',
      },
    },
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
  });

  console.log(`Total RLC 2025 images in database: ${images.length}`);
  
  const byModel = {};
  images.forEach(img => {
    const modelName = img.model?.castingName || 'Unknown';
    if (!byModel[modelName]) {
      byModel[modelName] = [];
    }
    byModel[modelName].push(img.path);
  });

  console.log('\nImages by model:');
  Object.keys(byModel).forEach(modelName => {
    console.log(`\n${modelName}:`);
    byModel[modelName].forEach(path => {
      console.log(`  - ${path}`);
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



