/**
 * Remove DB rows + on-disk images for Fast & Furious → Dream Lineup (2026) only.
 * Tokyo Drift 2026 is untouched.
 *
 *   npx ts-node scripts/tools/cleanup_2026_fast_furious_dream_lineup.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const YEAR = 2026;
const COLLECTION = 'Fast & Furious';
const SUBSERIES = 'Dream Lineup';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log(`=== CLEANUP ${YEAR} ${COLLECTION} / ${SUBSERIES} ===`);

  const sub = await prisma.subSeries.findFirst({
    where: {
      name: SUBSERIES,
      collection: { name: COLLECTION, year: { year: YEAR } },
    },
  });

  if (!sub) {
    console.log('SubSeries not found. Nothing to delete.');
    return;
  }

  const models = await prisma.model.findMany({
    where: { subSeriesId: sub.id, collection: { name: COLLECTION, year: { year: YEAR } } },
    select: { id: true, castingName: true },
  });

  if (models.length === 0) {
    console.log('No models under Dream Lineup. Nothing to delete.');
    return;
  }

  const modelIds = models.map((m) => m.id);

  const variants = await prisma.variant.findMany({
    where: {
      modelId: { in: modelIds },
      year: YEAR,
      releaseName: SUBSERIES,
    },
    select: { id: true },
  });

  const variantIds = variants.map((v) => v.id);
  console.log(`Models: ${modelIds.length}, variants (${YEAR}, ${SUBSERIES}): ${variantIds.length}`);

  if (variantIds.length === 0) {
    console.log('No matching variants; still removing orphan models if any.');
  }

  const baseImageDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    String(YEAR),
    'fast-and-furious',
  );

  for (const m of models) {
    const dir = path.join(baseImageDir, slugify(m.castingName));
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
      console.log(`Removed folder: ${dir}`);
    }
  }

  if (variantIds.length > 0) {
    await prisma.priceAlert.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.priceHistory.deleteMany({ where: { variantId: { in: variantIds } } });

    await prisma.variant.updateMany({
      where: { id: { in: variantIds } },
      data: { imageId: null },
    });

    const imgDel = await prisma.image.deleteMany({
      where: { variantId: { in: variantIds } },
    });
    console.log(`Deleted ${imgDel.count} variant images.`);

    const vDel = await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
    console.log(`Deleted ${vDel.count} variants.`);
  }

  await prisma.releaseDate.deleteMany({ where: { modelId: { in: modelIds } } });

  const mDel = await prisma.model.deleteMany({ where: { id: { in: modelIds } } });
  console.log(`Deleted ${mDel.count} models.`);

  const remaining = await prisma.model.count({ where: { subSeriesId: sub.id } });
  if (remaining === 0) {
    await prisma.subSeries.delete({ where: { id: sub.id } });
    console.log(`Removed empty SubSeries "${SUBSERIES}".`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
