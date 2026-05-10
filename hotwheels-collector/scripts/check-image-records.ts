import prisma from '../src/db';

async function checkImageRecords() {
  console.log('Checking image records in database...\n');

  // Get recent images (last 10)
  const recentImages = await prisma.image.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    include: {
      model: {
        select: {
          id: true,
          castingName: true,
        },
      },
    },
  });

  console.log(`Found ${recentImages.length} recent images:\n`);
  recentImages.forEach((img) => {
    console.log(`ID: ${img.id}`);
    console.log(`Path: ${img.path}`);
    console.log(`Model ID: ${img.modelId}`);
    console.log(`Model Name: ${img.model?.castingName || 'N/A'}`);
    console.log(`Alt: ${img.alt || 'N/A'}`);
    console.log(`Order: ${img.order ?? 'N/A'}`);
    console.log('---');
  });

  // Check specific model (16137 from logs)
  const modelImages = await prisma.image.findMany({
    where: { modelId: 16137 },
    include: {
      model: {
        select: {
          id: true,
          castingName: true,
        },
      },
    },
  });

  console.log(`\nImages for Model ID 16137: ${modelImages.length}`);
  modelImages.forEach((img) => {
    console.log(`- ID: ${img.id}, Path: ${img.path}`);
  });

  await prisma.$disconnect();
}

checkImageRecords().catch(console.error);








