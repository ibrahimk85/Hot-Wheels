const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    for (const y of [2025, 2026]) {
      const c = await p.collection.findFirst({
        where: { name: 'Formula 1', year: { year: y } },
        include: { subSeries: true },
      });
      console.log('year', y, 'collectionId', c && c.id, 'subSeries', c && c.subSeries && c.subSeries.length);
      if (!c) continue;
      const models = await p.model.count({ where: { collectionId: c.id } });
      const variants = await p.variant.count({ where: { model: { collectionId: c.id } } });
      const withMain = await p.variant.count({
        where: { model: { collectionId: c.id }, imageId: { not: null } },
      });
      const images = await p.image.count({ where: { variant: { model: { collectionId: c.id } } } });
      console.log('  models', models, 'variants', variants, 'variantsWithMain', withMain, 'images', images);
    }
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

