/**
 * Check Toy# for 2017 Mainline variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check main Mainline (COL# 1-365)
  const mainVariants = await prisma.variant.findMany({
    where: {
      year: 2017,
      cardNumber: { lte: '365' },
    },
    select: {
      toyNumber: true,
      cardNumber: true,
    },
    take: 20,
  });

  console.log('Sample COL# 1-365 variants:');
  const withToy = mainVariants.filter(v => v.toyNumber);
  const withoutToy = mainVariants.filter(v => !v.toyNumber);
  
  console.log(`  With Toy#: ${withToy.length}/${mainVariants.length}`);
  console.log(`  Without Toy#: ${withoutToy.length}/${mainVariants.length}`);
  
  if (withToy.length > 0) {
    console.log('\n  Sample with Toy#:');
    withToy.slice(0, 5).forEach((v, i) => {
      console.log(`    ${i + 1}. COL# ${v.cardNumber}, Toy#: ${v.toyNumber}`);
    });
  }

  // Check additional tables (COL# 366+)
  const additionalVariants = await prisma.variant.findMany({
    where: {
      year: 2017,
      cardNumber: { gte: '366' },
    },
    select: {
      toyNumber: true,
      cardNumber: true,
    },
  });

  console.log(`\nCOL# 366+ variants: ${additionalVariants.length}`);
  const additionalWithToy = additionalVariants.filter(v => v.toyNumber);
  const additionalWithoutToy = additionalVariants.filter(v => !v.toyNumber);
  
  console.log(`  With Toy#: ${additionalWithToy.length}/${additionalVariants.length}`);
  console.log(`  Without Toy#: ${additionalWithoutToy.length}/${additionalVariants.length}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














