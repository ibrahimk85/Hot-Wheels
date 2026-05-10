/**
 * One-off / idempotent fix: 2002 wiki "Final Run" table uses Toy# that also appear in open stock.
 * - Merges SubSeries "2002 Final Run" → "Final Run"
 * - For wiki Final Run Toy#s, removes duplicate Variant (same year + Toy# in Mainline) keeping Final Run
 * - Points surviving Model at "Final Run" and sets variant.releaseName to "Final Run"
 *
 *   npx ts-node scripts/tools/fix_2002_final_run_subseries.ts
 *
 * Toy#s from List_of_2002_Hot_Wheels Final Run section (2002).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_YEAR = 2002;
const COLLECTION_NAME = 'Mainline';
const FINAL_RUN_SUBSERIES = 'Final Run';
const LEGACY_FINAL_RUN = '2002 Final Run';
/** Toy# from Fandom Final Run table (not COL# — those can repeat across series) */
const FINAL_RUN_TOY_NUMBERS = ['55811', '55815', '55816'] as const;

async function main() {
  const yearRow = await prisma.year.findFirst({ where: { year: TARGET_YEAR } });
  if (!yearRow) {
    console.log(`No Year ${TARGET_YEAR} in DB.`);
    return;
  }

  const collection = await prisma.collection.findFirst({
    where: { name: COLLECTION_NAME, yearId: yearRow.id },
  });
  if (!collection) {
    console.log(`No ${COLLECTION_NAME} collection for ${TARGET_YEAR}.`);
    return;
  }

  let finalRun = await prisma.subSeries.findFirst({
    where: { collectionId: collection.id, name: FINAL_RUN_SUBSERIES },
  });
  if (!finalRun) {
    finalRun = await prisma.subSeries.create({
      data: { name: FINAL_RUN_SUBSERIES, collectionId: collection.id },
    });
    console.log(`Created SubSeries: ${FINAL_RUN_SUBSERIES}`);
  }

  const legacy = await prisma.subSeries.findFirst({
    where: { collectionId: collection.id, name: LEGACY_FINAL_RUN },
  });
  if (legacy) {
    const moved = await prisma.model.updateMany({
      where: { subSeriesId: legacy.id },
      data: { subSeriesId: finalRun.id },
    });
    console.log(`Moved ${moved.count} models from "${LEGACY_FINAL_RUN}" → "${FINAL_RUN_SUBSERIES}"`);
    try {
      await prisma.subSeries.delete({ where: { id: legacy.id } });
      console.log(`Removed empty SubSeries "${LEGACY_FINAL_RUN}"`);
    } catch {
      console.warn(`Could not delete "${LEGACY_FINAL_RUN}" (still referenced?)`);
    }
  }

  for (const toyRaw of FINAL_RUN_TOY_NUMBERS) {
    const toy = toyRaw.trim();
    const variants = await prisma.variant.findMany({
      where: {
        year: TARGET_YEAR,
        toyNumber: toy,
        model: { collectionId: collection.id },
      },
      include: {
        model: { include: { subSeries: true } },
      },
    });

    if (variants.length === 0) {
      console.log(`  No variant for Toy# ${toy} — skip`);
      continue;
    }

    const score = (v: (typeof variants)[0]) => {
      const n = v.model.subSeries?.name ?? '';
      if (n === FINAL_RUN_SUBSERIES) return 3;
      if (n === LEGACY_FINAL_RUN) return 2;
      if (/final run/i.test(v.releaseName ?? '')) return 1;
      return 0;
    };

    const keeper = variants.reduce((a, b) => (score(b) > score(a) ? b : a));

    for (const v of variants) {
      if (v.id === keeper.id) continue;
      const mid = v.modelId;
      await prisma.variant.delete({ where: { id: v.id } });
      console.log(`  Removed duplicate variant id=${v.id} Toy#=${toy} (kept id=${keeper.id})`);
      const leftOnModel = await prisma.variant.count({ where: { modelId: mid } });
      if (leftOnModel === 0) {
        await prisma.model.delete({ where: { id: mid } });
        console.log(`  Removed empty model id=${mid}`);
      }
    }

    await prisma.model.update({
      where: { id: keeper.modelId },
      data: { subSeriesId: finalRun.id },
    });
    await prisma.variant.update({
      where: { id: keeper.id },
      data: { releaseName: FINAL_RUN_SUBSERIES },
    });
    console.log(`  Toy# ${toy}: single variant → "${FINAL_RUN_SUBSERIES}" (variant ${keeper.id})`);
  }

  await prisma.variant.updateMany({
    where: {
      year: TARGET_YEAR,
      releaseName: LEGACY_FINAL_RUN,
      model: { collectionId: collection.id, subSeriesId: finalRun.id },
    },
    data: { releaseName: FINAL_RUN_SUBSERIES },
  });

  console.log('\n✅ 2002 Final Run subseries fix done.');
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
