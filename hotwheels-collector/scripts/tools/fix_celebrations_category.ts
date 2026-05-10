/**
 * Fix: Update Celebrations Pontiac SubSeries category from Automotive to Celebrations
 * npx ts-node scripts/tools/fix_celebrations_category.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.subSeries.updateMany({
    where: {
      name: { contains: 'Celebrations - Pontiac 100th Anniversary' },
      category: 'Automotive',
    },
    data: { category: 'Celebrations' },
  });
  console.log(`Updated ${updated.count} SubSeries to category Celebrations`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
