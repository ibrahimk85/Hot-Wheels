/**
 * Script to check TH and STH counts for 2021 Mainline
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCounts() {
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2021,
      },
    },
  });

  if (!mainlineCollection) {
    console.error('❌ 2021 Mainline collection not found!');
    return;
  }

  const thCount = await prisma.variant.count({
    where: {
      year: 2021,
      isTreasureHunt: true,
      isSuperTreasureHunt: false,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  const sthCount = await prisma.variant.count({
    where: {
      year: 2021,
      isSuperTreasureHunt: true,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  const totalCount = await prisma.variant.count({
    where: {
      year: 2021,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  console.log('=== 2021 Mainline TH/STH Counts ===\n');
  console.log(`Total variants: ${totalCount}`);
  console.log(`Treasure Hunts (TH): ${thCount}`);
  console.log(`Super Treasure Hunts (STH): ${sthCount}`);
  console.log(`Regular variants: ${totalCount - thCount - sthCount}\n`);
}

checkCounts()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















