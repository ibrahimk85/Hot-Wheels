/**
 * Check 2017 COL# 366+ variants without Toy#
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      year: 2017,
      cardNumber: { gte: '366' },
      toyNumber: null,
    },
    include: {
      model: {
        include: {
          subSeries: true,
        },
      },
    },
  });

  console.log(`Found ${variants.length} COL# 366+ variants without Toy#:\n`);
  
  variants.forEach((v, i) => {
    console.log(`${i + 1}. ${v.model.castingName} (COL#: ${v.cardNumber}, SubSeries: ${v.model.subSeries?.name})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














