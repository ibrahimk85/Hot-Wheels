import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking 2026 Mainline TH and STH data...\n');

  const thCount = await prisma.variant.count({
    where: {
      year: 2026,
      isTreasureHunt: true,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  });

  const sthCount = await prisma.variant.count({
    where: {
      year: 2026,
      isSuperTreasureHunt: true,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
  });

  console.log(`TH count: ${thCount}`);
  console.log(`STH count: ${sthCount}\n`);

  if (thCount > 0) {
    const thExamples = await prisma.variant.findMany({
      where: {
        year: 2026,
        isTreasureHunt: true,
        model: {
          collection: {
            name: 'Mainline',
          },
        },
      },
      select: {
        id: true,
        cardNumber: true,
        toyNumber: true,
        model: {
          select: {
            castingName: true,
          },
        },
      },
      take: 5,
    });
    console.log('TH examples:');
    thExamples.forEach((v) => {
      console.log(`  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${v.toyNumber})`);
    });
  }

  if (sthCount > 0) {
    const sthExamples = await prisma.variant.findMany({
      where: {
        year: 2026,
        isSuperTreasureHunt: true,
        model: {
          collection: {
            name: 'Mainline',
          },
        },
      },
      select: {
        id: true,
        cardNumber: true,
        toyNumber: true,
        model: {
          select: {
            castingName: true,
          },
        },
      },
      take: 5,
    });
    console.log('\nSTH examples:');
    sthExamples.forEach((v) => {
      console.log(`  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${v.toyNumber})`);
    });
  }

  // Check all 2026 variants to see if any have seriesInfo that might contain TH/STH
  const all2026Variants = await prisma.variant.findMany({
    where: {
      year: 2026,
      model: {
        collection: {
          name: 'Mainline',
        },
      },
    },
    select: {
      id: true,
      cardNumber: true,
      toyNumber: true,
      isTreasureHunt: true,
      isSuperTreasureHunt: true,
      notes: true,
      model: {
        select: {
          castingName: true,
        },
      },
    },
    take: 20,
  });

  console.log('\n\nSample 2026 variants (first 20):');
  all2026Variants.forEach((v) => {
    const flags = [];
    if (v.isTreasureHunt) flags.push('TH');
    if (v.isSuperTreasureHunt) flags.push('STH');
    console.log(
      `  - ${v.model.castingName} (COL#${v.cardNumber}, Toy#${v.toyNumber}) ${flags.length > 0 ? `[${flags.join(', ')}]` : ''} ${v.notes ? `Notes: ${v.notes}` : ''}`
    );
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });









