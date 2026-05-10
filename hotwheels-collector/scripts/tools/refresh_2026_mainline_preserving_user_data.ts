/**
 * Option B: Snapshot packed/loose (and related) user fields → delete 2026 Mainline data →
 * re-import from wiki → re-download images → restore user fields keyed by Toy# and casting+sub-series.
 *
 * Snapshot JSON is written to backups/2026-mainline-user-data-<ISO>.json (manual rollback reference).
 *
 * Env:
 *   MAINLINE_2026_WIKI_URL — optional override (defaults to scripts/config/mainline_urls.json + List_of_YYYY fallback)
 *
 * Usage:
 *   npx ts-node scripts/tools/refresh_2026_mainline_preserving_user_data.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { runImport2026Mainline } from '../import/import_2026_mainline.ts';
import { delete2026MainlineData } from './delete_2026_mainline.ts';
import { runDownloadAndSyncImages2026Mainline } from './download_and_sync_images_2026_mainline.ts';
import { getMainlineWikiUrlForYear } from '../lib/mainline-urls.ts';

const TARGET_YEAR = 2026;
const MAINLINE_NAME = 'Mainline';

function modelRestoreKey(castingName: string, subSeriesName: string): string {
  return `${castingName}\u001f${subSeriesName}`;
}

export interface VariantUserSnapshot {
  packedOwned: boolean;
  looseOwned: boolean;
  owned: boolean;
  wishlisted: boolean;
  quantity: number;
  condition: string | null;
  notes: string | null;
}

export interface ModelUserSnapshot {
  packedPurchasePrice: number | null;
  packedMarketPrice: number | null;
  packedOriginalPrice: number | null;
  loosePurchasePrice: number | null;
  looseMarketPrice: number | null;
  packedPrice: number | null;
  loosePrice: number | null;
  owned: boolean;
  wishlisted: boolean;
  quantity: number;
  notes: string | null;
  saleDate: string | null;
}

export interface Mainline2026RefreshSnapshot {
  createdAt: string;
  wikiUrl: string;
  variantByToyNumber: Record<string, VariantUserSnapshot>;
  modelByCastingAndSubSeries: Record<string, ModelUserSnapshot>;
}

function resolveWikiUrl(): string {
  const env = process.env.MAINLINE_2026_WIKI_URL?.trim();
  if (env) return env;
  return getMainlineWikiUrlForYear(TARGET_YEAR);
}

async function buildSnapshot(prisma: PrismaClient): Promise<{
  snapshot: Mainline2026RefreshSnapshot;
  collectionId: number | null;
}> {
  const collection = await prisma.collection.findFirst({
    where: {
      name: MAINLINE_NAME,
      year: { year: TARGET_YEAR },
    },
  });

  const wikiUrl = resolveWikiUrl();
  const snapshot: Mainline2026RefreshSnapshot = {
    createdAt: new Date().toISOString(),
    wikiUrl,
    variantByToyNumber: {},
    modelByCastingAndSubSeries: {},
  };

  if (!collection) {
    console.log('No 2026 Mainline collection yet — empty snapshot (first import).');
    return { snapshot, collectionId: null };
  }

  const variants = await prisma.variant.findMany({
    where: {
      year: TARGET_YEAR,
      model: { collectionId: collection.id },
    },
    select: {
      toyNumber: true,
      packedOwned: true,
      looseOwned: true,
      owned: true,
      wishlisted: true,
      quantity: true,
      condition: true,
      notes: true,
    },
  });

  for (const v of variants) {
    const tn = v.toyNumber?.trim();
    if (!tn) continue;
    snapshot.variantByToyNumber[tn] = {
      packedOwned: v.packedOwned,
      looseOwned: v.looseOwned,
      owned: v.owned,
      wishlisted: v.wishlisted,
      quantity: v.quantity,
      condition: v.condition ?? null,
      notes: v.notes ?? null,
    };
  }

  const models = await prisma.model.findMany({
    where: { collectionId: collection.id },
    include: { subSeries: true },
  });

  for (const m of models) {
    const subName = m.subSeries?.name ?? '';
    const key = modelRestoreKey(m.castingName, subName);
    snapshot.modelByCastingAndSubSeries[key] = {
      packedPurchasePrice: m.packedPurchasePrice ?? null,
      packedMarketPrice: m.packedMarketPrice ?? null,
      packedOriginalPrice: m.packedOriginalPrice ?? null,
      loosePurchasePrice: m.loosePurchasePrice ?? null,
      looseMarketPrice: m.looseMarketPrice ?? null,
      packedPrice: m.packedPrice ?? null,
      loosePrice: m.loosePrice ?? null,
      owned: m.owned,
      wishlisted: m.wishlisted,
      quantity: m.quantity,
      notes: m.notes ?? null,
      saleDate: m.saleDate ?? null,
    };
  }

  console.log(
    `Snapshot: ${Object.keys(snapshot.variantByToyNumber).length} Toy# keys, ${models.length} models.`,
  );

  return { snapshot, collectionId: collection.id };
}

async function restoreUserData(
  prisma: PrismaClient,
  collectionId: number,
  snap: Mainline2026RefreshSnapshot,
): Promise<{ variantsUpdated: number; modelsUpdated: number; toyNumbersNotFound: string[] }> {
  let variantsUpdated = 0;
  let modelsUpdated = 0;
  const toyNumbersNotFound: string[] = [];

  const models = await prisma.model.findMany({
    where: { collectionId },
    include: { subSeries: true },
  });

  for (const m of models) {
    const key = modelRestoreKey(m.castingName, m.subSeries?.name ?? '');
    const ms = snap.modelByCastingAndSubSeries[key];
    if (!ms) continue;

    await prisma.model.update({
      where: { id: m.id },
      data: {
        packedPurchasePrice: ms.packedPurchasePrice ?? undefined,
        packedMarketPrice: ms.packedMarketPrice ?? undefined,
        packedOriginalPrice: ms.packedOriginalPrice ?? undefined,
        loosePurchasePrice: ms.loosePurchasePrice ?? undefined,
        looseMarketPrice: ms.looseMarketPrice ?? undefined,
        packedPrice: ms.packedPrice ?? undefined,
        loosePrice: ms.loosePrice ?? undefined,
        owned: ms.owned,
        wishlisted: ms.wishlisted,
        quantity: ms.quantity,
        notes: ms.notes ?? undefined,
        saleDate: ms.saleDate ?? undefined,
      },
    });
    modelsUpdated++;
  }

  for (const [toyNumber, vs] of Object.entries(snap.variantByToyNumber)) {
    const result = await prisma.variant.updateMany({
      where: {
        toyNumber,
        year: TARGET_YEAR,
        model: { collectionId },
      },
      data: {
        packedOwned: vs.packedOwned,
        looseOwned: vs.looseOwned,
        owned: vs.owned,
        wishlisted: vs.wishlisted,
        quantity: vs.quantity,
        condition: vs.condition ?? undefined,
        notes: vs.notes ?? undefined,
      },
    });

    if (result.count === 0) {
      toyNumbersNotFound.push(toyNumber);
    } else {
      variantsUpdated += result.count;
    }
  }

  return { variantsUpdated, modelsUpdated, toyNumbersNotFound };
}

async function main() {
  const prisma = new PrismaClient();
  const wikiUrl = resolveWikiUrl();
  console.log(`Wiki URL: ${wikiUrl}\n`);

  try {
    const { snapshot } = await buildSnapshot(prisma);

    const backupsDir = path.join(process.cwd(), 'backups');
    await fs.promises.mkdir(backupsDir, { recursive: true });
    const stamp = snapshot.createdAt.replace(/[:.]/g, '-');
    const snapshotPath = path.join(backupsDir, `2026-mainline-user-data-${stamp}.json`);
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`Wrote snapshot: ${snapshotPath}\n`);

    console.log('--- Delete 2026 Mainline ---\n');
    const del = await delete2026MainlineData(prisma);
    if (del.skippedNoCollection) {
      console.log('No existing collection — skipping delete.\n');
    }

    console.log('--- Import from wiki ---\n');
    await runImport2026Mainline(prisma, wikiUrl);

    console.log('\n--- Download & sync images ---\n');
    await runDownloadAndSyncImages2026Mainline(prisma, wikiUrl);

    const collectionAfter = await prisma.collection.findFirst({
      where: { name: MAINLINE_NAME, year: { year: TARGET_YEAR } },
    });
    if (!collectionAfter) {
      throw new Error('2026 Mainline collection missing after import.');
    }

    console.log('\n--- Restore user fields from snapshot ---\n');
    const { variantsUpdated, modelsUpdated, toyNumbersNotFound } = await restoreUserData(
      prisma,
      collectionAfter.id,
      snapshot,
    );

    console.log(`Models updated (prices/ownership): ${modelsUpdated}`);
    console.log(`Variant rows updated (packed/loose/etc.): ${variantsUpdated}`);
    if (toyNumbersNotFound.length > 0) {
      console.log(
        `\n⚠ ${toyNumbersNotFound.length} Toy# from snapshot were not found after re-import (removed from wiki or empty Toy#):`,
      );
      console.log(toyNumbersNotFound.slice(0, 40).join(', ') + (toyNumbersNotFound.length > 40 ? ' …' : ''));
    }

    console.log('\n✅ Refresh completed.');
    console.log(`Snapshot file (keep for safety): ${snapshotPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
