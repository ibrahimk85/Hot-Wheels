/**
 * Remove Silver Series sub-series and all their data (models, variants, images).
 * Usage: npx ts-node scripts/tools/remove_silver_series_subseries.ts "Fast & Furious (2019)" 2019
 *        npx ts-node scripts/tools/remove_silver_series_subseries.ts "Fast & Furious (2021)" 2021
 * Or run with multiple targets: pass pairs of "namePattern" year (e.g. "Fast & Furious (2019)" 2019 "Fast & Furious (2021)" 2021)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const COLLECTION_NAME = 'Hot Wheels Silver Series';

const prisma = new PrismaClient();

function parseArgs(): { namePattern: string; year: number }[] {
  const args = process.argv.slice(2);
  const targets: { namePattern: string; year: number }[] = [];
  for (let i = 0; i + 1 < args.length; i += 2) {
    const namePattern = args[i];
    const year = parseInt(args[i + 1], 10);
    if (namePattern && !isNaN(year)) targets.push({ namePattern, year });
  }
  return targets;
}

async function removeOne(namePattern: string, year: number) {
  const yearRec = await prisma.year.findFirst({ where: { year } });
  if (!yearRec) {
    console.log(`Year ${year} not found. Nothing to remove.`);
    return;
  }

  const coll = await prisma.collection.findFirst({
    where: { name: COLLECTION_NAME, yearId: yearRec.id },
  });
  if (!coll) {
    console.log(`Collection ${COLLECTION_NAME} (${year}) not found. Nothing to remove.`);
    return;
  }

  const subSeriesList = await prisma.subSeries.findMany({
    where: {
      collectionId: coll.id,
      name: { contains: namePattern },
    },
    include: { models: { include: { variants: true } } },
  });

  if (subSeriesList.length === 0) {
    console.log(`No sub-series matching "${namePattern}" for ${COLLECTION_NAME} ${year}. Nothing to remove.`);
    return;
  }

  let totalImages = 0;
  let totalVariants = 0;
  let totalModels = 0;

  for (const sub of subSeriesList) {
    console.log(`Removing SubSeries: ${sub.name} (id=${sub.id})`);
    const modelIds = sub.models.map((m) => m.id);
    const variantIds = sub.models.flatMap((m) => m.variants.map((v) => v.id));

    let imgCount = 0;
    if (variantIds.length > 0) {
      const delImgV = await prisma.image.deleteMany({ where: { variantId: { in: variantIds } } });
      imgCount += delImgV.count;
      const delV = await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
      totalVariants += delV.count;
    }
    if (modelIds.length > 0) {
      const delImgM = await prisma.image.deleteMany({ where: { modelId: { in: modelIds } } });
      imgCount += delImgM.count;
      const delM = await prisma.model.deleteMany({ where: { id: { in: modelIds } } });
      totalModels += delM.count;
    }
    totalImages += imgCount;

    await prisma.releaseDate.deleteMany({ where: { subSeriesId: sub.id } });
    await prisma.subSeries.delete({ where: { id: sub.id } });
    console.log(`  Deleted ${sub.models.length} models, ${variantIds.length} variants, ${imgCount} images.`);
  }

  console.log(`Done for ${year}. Removed ${subSeriesList.length} sub-series, ${totalModels} models, ${totalVariants} variants, ${totalImages} images.`);
}

async function main() {
  const targets = parseArgs();
  if (targets.length === 0) {
    console.log('Usage: npx ts-node scripts/tools/remove_silver_series_subseries.ts "Fast & Furious (2019)" 2019 ["Fast & Furious (2021)" 2021 ...]');
    return;
  }
  for (const { namePattern, year } of targets) {
    console.log(`\n--- ${COLLECTION_NAME} ${year}: "${namePattern}" ---`);
    await removeOne(namePattern, year);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
