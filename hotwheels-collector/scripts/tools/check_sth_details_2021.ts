/**
 * Script to check STH details for 2021 Mainline
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSTHDetails() {
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

  const sthVariants = await prisma.variant.findMany({
    where: {
      year: 2021,
      isSuperTreasureHunt: true,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: {
        select: {
          castingName: true,
          castingId: true,
        },
      },
    },
    orderBy: {
      cardNumber: 'asc',
    },
  });

  console.log('=== 2021 Mainline STH Details ===\n');
  console.log(`Total STH variants: ${sthVariants.length}\n`);

  // Group by cardNumber to find duplicates
  const groupedByCard = new Map<string, typeof sthVariants>();
  for (const variant of sthVariants) {
    const key = variant.cardNumber || 'NO_CARD';
    if (!groupedByCard.has(key)) {
      groupedByCard.set(key, []);
    }
    groupedByCard.get(key)!.push(variant);
  }

  console.log('STH variants grouped by card number:\n');
  for (const [cardNumber, variants] of groupedByCard.entries()) {
    if (variants.length > 1) {
      console.log(`⚠️  Card # ${cardNumber} - ${variants.length} variants (DUPLICATE!):`);
      for (const variant of variants) {
        console.log(`    - Variant ID: ${variant.id}, Model: ${variant.model.castingName} (${variant.model.castingId}), Color: ${variant.color || 'null'}`);
      }
      console.log('');
    } else {
      console.log(`✓ Card # ${cardNumber} - ${variants[0].model.castingName} (${variants[0].model.castingId})`);
    }
  }

  // Count unique card numbers
  const uniqueCardNumbers = new Set(sthVariants.map(v => v.cardNumber));
  console.log(`\nUnique STH card numbers: ${uniqueCardNumbers.size}`);
  console.log(`Total STH variants: ${sthVariants.length}`);
  if (sthVariants.length > uniqueCardNumbers.size) {
    console.log(`⚠️  Found ${sthVariants.length - uniqueCardNumbers.size} duplicate STH variants!`);
  }
}

checkSTHDetails()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















