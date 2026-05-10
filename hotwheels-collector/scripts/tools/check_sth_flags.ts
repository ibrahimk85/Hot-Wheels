import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sthCount = await prisma.variant.count({
    where: {
      year: 2021,
      isSuperTreasureHunt: true,
    },
  });

  const thCount = await prisma.variant.count({
    where: {
      year: 2021,
      isTreasureHunt: true,
    },
  });

  console.log('2021 STH count:', sthCount);
  console.log('2021 TH count:', thCount);

  const sthExamples = await prisma.variant.findMany({
    where: {
      year: 2021,
      isSuperTreasureHunt: true,
    },
    take: 5,
    include: {
      model: true,
    },
  });

  console.log('\nSTH examples:');
  sthExamples.forEach((v) => {
    console.log(
      `  - ${v.model.castingName} (Card #${v.cardNumber}, STH: ${v.isSuperTreasureHunt}, TH: ${v.isTreasureHunt})`
    );
  });

  // Check if there are variants with both TH and STH flags (should not happen)
  const bothFlags = await prisma.variant.findMany({
    where: {
      year: 2021,
      isTreasureHunt: true,
      isSuperTreasureHunt: true,
    },
    take: 5,
    include: {
      model: true,
    },
  });

  if (bothFlags.length > 0) {
    console.log('\n⚠️  WARNING: Found variants with both TH and STH flags:');
    bothFlags.forEach((v) => {
      console.log(
        `  - ${v.model.castingName} (Card #${v.cardNumber}, STH: ${v.isSuperTreasureHunt}, TH: ${v.isTreasureHunt})`
      );
    });
  }

  // Check variants that should be STH based on import logs
  const expectedSTH = [
    'Nissan 300ZX Twin Turbo',
    'Corvette Grand Sport Roadster',
    'Rodger Dodger',
    "'95 Mazda RX-7",
    "Corvette C7 Z06 Convertible",
    'Mazda RX-3',
    '2020 Ford Mustang Shelby GT500',
    "'71 Datsun 510",
    '2018 Honda Civic Type R',
    "'68 Mercury Cougar",
    '2019 Audi R8 Spyder',
    "'49 Ford F1",
    'Porsche 356 Outlaw',
    "'64 Nova Wagon Gasser",
    'Shelby Cobra 427 S/C',
  ];

  console.log('\nChecking expected STH models:');
  for (const modelName of expectedSTH) {
    const variants = await prisma.variant.findMany({
      where: {
        year: 2021,
        model: {
          castingName: modelName,
        },
      },
      include: {
        model: true,
      },
    });

    const sthVariants = variants.filter((v) => v.isSuperTreasureHunt);
    const thVariants = variants.filter((v) => v.isTreasureHunt && !v.isSuperTreasureHunt);

    if (sthVariants.length === 0) {
      console.log(`  ❌ ${modelName}: No STH variants found (found ${variants.length} total variants)`);
      if (thVariants.length > 0) {
        console.log(`     ⚠️  But found ${thVariants.length} TH variants (should be STH!)`);
      }
    } else {
      console.log(`  ✅ ${modelName}: Found ${sthVariants.length} STH variant(s)`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















