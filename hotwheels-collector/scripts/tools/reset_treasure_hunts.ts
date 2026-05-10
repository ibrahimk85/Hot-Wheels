/**
 * Script to reset all Treasure Hunt (TH) and Super Treasure Hunt (STH) flags
 * Sets isTreasureHunt and isSuperTreasureHunt to false for all variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Resetting All Treasure Hunt Flags ===\n');

  // Count current TH/STH variants
  const thCount = await prisma.variant.count({
    where: {
      isTreasureHunt: true,
    },
  });

  const sthCount = await prisma.variant.count({
    where: {
      isSuperTreasureHunt: true,
    },
  });

  console.log(`Current TH variants: ${thCount}`);
  console.log(`Current STH variants: ${sthCount}`);

  if (thCount === 0 && sthCount === 0) {
    console.log('\nNo TH/STH variants found. Nothing to reset.');
    return;
  }

  console.log('\nResetting all TH flags...');
  const thResult = await prisma.variant.updateMany({
    where: {
      isTreasureHunt: true,
    },
    data: {
      isTreasureHunt: false,
    },
  });

  console.log(`Reset ${thResult.count} TH variants`);

  console.log('\nResetting all STH flags...');
  const sthResult = await prisma.variant.updateMany({
    where: {
      isSuperTreasureHunt: true,
    },
    data: {
      isSuperTreasureHunt: false,
    },
  });

  console.log(`Reset ${sthResult.count} STH variants`);

  // Verify
  const remainingTH = await prisma.variant.count({
    where: {
      isTreasureHunt: true,
    },
  });

  const remainingSTH = await prisma.variant.count({
    where: {
      isSuperTreasureHunt: true,
    },
  });

  console.log('\n=== Reset Summary ===');
  console.log(`TH variants reset: ${thResult.count}`);
  console.log(`STH variants reset: ${sthResult.count}`);
  console.log(`Remaining TH: ${remainingTH}`);
  console.log(`Remaining STH: ${remainingSTH}`);

  if (remainingTH === 0 && remainingSTH === 0) {
    console.log('\n✓ All Treasure Hunt flags have been successfully reset!');
  } else {
    console.log('\n⚠ Warning: Some flags may still be set. Please check manually.');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










