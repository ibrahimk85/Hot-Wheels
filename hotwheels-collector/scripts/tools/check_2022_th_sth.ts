import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check2022THSTH() {
  console.log('=== Checking 2022 Mainline TH/STH ===\n');

  // Get all 2022 Mainline variants
  const variants = await prisma.variant.findMany({
    where: {
      year: 2022,
      model: {
        collection: {
          name: 'Mainline',
          year: {
            year: 2022,
          },
        },
      },
    },
    include: {
      model: true,
    },
  });

  console.log(`Total variants: ${variants.length}\n`);

  const thVariants = variants.filter(v => v.isTreasureHunt && !v.isSuperTreasureHunt);
  const sthVariants = variants.filter(v => v.isSuperTreasureHunt);

  console.log(`TH variants: ${thVariants.length}`);
  console.log(`STH variants: ${sthVariants.length}\n`);

  if (thVariants.length > 0) {
    console.log('TH Examples (first 5):');
    thVariants.slice(0, 5).forEach(v => {
      console.log(`  - ${v.model.castingName} (Toy#: ${v.toyNumber || 'N/A'}, COL#: ${v.cardNumber || 'N/A'})`);
    });
  }

  if (sthVariants.length > 0) {
    console.log('\nSTH Examples (first 5):');
    sthVariants.slice(0, 5).forEach(v => {
      console.log(`  - ${v.model.castingName} (Toy#: ${v.toyNumber || 'N/A'}, COL#: ${v.cardNumber || 'N/A'})`);
    });
  }
}

check2022THSTH()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








