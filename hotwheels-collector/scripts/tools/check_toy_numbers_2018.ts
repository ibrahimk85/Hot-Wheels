import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
    },
    select: {
      toyNumber: true,
      cardNumber: true,
      isTreasureHunt: true,
      isSuperTreasureHunt: true,
    },
    take: 20,
  });

  console.log('Sample Toy# values from database:');
  variants.forEach(v => {
    console.log(`  Toy#: ${v.toyNumber}, Card#: ${v.cardNumber}, TH: ${v.isTreasureHunt}, STH: ${v.isSuperTreasureHunt}`);
  });

  // Check if any TH/STH Toy# exist
  const thToyNumbers = ['FKB29', 'FJW90', 'FKB31'];
  const sthToyNumbers = ['FKB40', 'FKB41', 'FKB47'];
  
  console.log('\nChecking if TH Toy# exist:');
  for (const toyNumber of thToyNumbers) {
    const found = await prisma.variant.findFirst({
      where: {
        year: 2018,
        toyNumber: toyNumber,
      },
    });
    console.log(`  ${toyNumber}: ${found ? 'Found' : 'Not found'}`);
  }

  console.log('\nChecking if STH Toy# exist:');
  for (const toyNumber of sthToyNumbers) {
    const found = await prisma.variant.findFirst({
      where: {
        year: 2018,
        toyNumber: toyNumber,
      },
    });
    console.log(`  ${toyNumber}: ${found ? 'Found' : 'Not found'}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });















