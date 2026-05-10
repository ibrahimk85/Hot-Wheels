import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== CLEANUP 2026 FAST & FURIOUS PREMIUM (IMPORT + IMAGES) ===');

  // Find 2026 year record
  const year2026 = await prisma.year.findFirst({ where: { year: 2026 } });
  if (!year2026) {
    console.log('No Year 2026 record found. Nothing to clean up.');
    return;
  }

  // Find Fast & Furious Premium collection for 2026
  const collection = await prisma.collection.findFirst({
    where: {
      name: 'Fast & Furious Premium',
      yearId: year2026.id,
    },
    include: {
      subSeries: true,
      models: {
        include: {
          variants: true,
        },
      },
    },
  });

  if (!collection) {
    console.log('No 2026 Fast & Furious Premium collection found. Nothing to clean up.');
    return;
  }

  console.log(
    `Found 2026 Fast & Furious Premium collection (id=${collection.id}), subSeries=${collection.subSeries.length}, models=${collection.models.length}`,
  );

  // Collect all variant IDs for this 2026 collection
  const variantIds: number[] = [];
  for (const model of collection.models) {
    for (const v of model.variants) {
      if (v.year === 2026) {
        variantIds.push(v.id);
      }
    }
  }

  console.log(`Total variants for 2026 F&F Premium: ${variantIds.length}`);

  // Delete images linked to these variants
  if (variantIds.length > 0) {
    const deleteVariantImagesResult = await prisma.image.deleteMany({
      where: {
        variantId: { in: variantIds },
      },
    });
    console.log(
      `Deleted ${deleteVariantImagesResult.count} images linked to 2026 F&F Premium variants.`,
    );
  }

  // Delete variants for 2026 F&F Premium
  if (variantIds.length > 0) {
    const deleteVariantsResult = await prisma.variant.deleteMany({
      where: {
        id: { in: variantIds },
      },
    });
    console.log(`Deleted ${deleteVariantsResult.count} variants for 2026 F&F Premium.`);
  }

  // Delete models that now have no variants and belong to this collection
  const modelIds = collection.models.map((m) => m.id);
  if (modelIds.length > 0) {
    const modelsWithVariants = await prisma.model.findMany({
      where: {
        id: { in: modelIds },
        variants: {
          some: {},
        },
      },
      select: { id: true },
    });

    const modelIdsWithVariants = new Set(modelsWithVariants.map((m) => m.id));
    const orphanModelIds = modelIds.filter((id) => !modelIdsWithVariants.has(id));

    if (orphanModelIds.length > 0) {
      // Delete images linked directly to these models
      const deleteModelImagesResult = await prisma.image.deleteMany({
        where: {
          modelId: { in: orphanModelIds },
        },
      });
      console.log(
        `Deleted ${deleteModelImagesResult.count} images linked to 2026 F&F Premium models.`,
      );

      const deleteModelsResult = await prisma.model.deleteMany({
        where: {
          id: { in: orphanModelIds },
        },
      });
      console.log(`Deleted ${deleteModelsResult.count} models for 2026 F&F Premium.`);
    }
  }

  // Optionally delete subSeries (Mix 1/2/3) if they have no models left
  const subSeriesIds = collection.subSeries.map((s) => s.id);
  if (subSeriesIds.length > 0) {
    const subSeriesWithModels = await prisma.subSeries.findMany({
      where: {
        id: { in: subSeriesIds },
        models: {
          some: {},
        },
      },
      select: { id: true },
    });

    const subSeriesIdsWithModels = new Set(subSeriesWithModels.map((s) => s.id));
    const orphanSubSeriesIds = subSeriesIds.filter((id) => !subSeriesIdsWithModels.has(id));

    if (orphanSubSeriesIds.length > 0) {
      const deleteSubSeriesResult = await prisma.subSeries.deleteMany({
        where: {
          id: { in: orphanSubSeriesIds },
        },
      });
      console.log(
        `Deleted ${deleteSubSeriesResult.count} subSeries (likely Mix 1/2/3) with no models left.`,
      );
    }
  }

  console.log('Cleanup completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

