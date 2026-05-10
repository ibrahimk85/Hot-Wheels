/**
 * Check 2017 Mainline variant count and max COL#
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      year: 2017,
      model: {
        collection: {
          name: 'Mainline',
          year: { year: 2017 },
        },
      },
    },
    select: {
      cardNumber: true,
    },
    orderBy: {
      cardNumber: 'desc',
    },
  });

  console.log(`Total 2017 Mainline variants: ${variants.length}`);
  
  const numericCols = variants
    .map(v => parseInt(v.cardNumber || '0'))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => b - a);
  
  if (numericCols.length > 0) {
    console.log(`Max COL#: ${numericCols[0]}`);
    console.log(`Min COL#: ${numericCols[numericCols.length - 1]}`);
    console.log(`\nNext COL# for additional tables should start from: ${numericCols[0] + 1}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














