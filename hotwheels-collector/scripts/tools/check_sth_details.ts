import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check specific STH models that were logged during import
  const expectedSTHModels = [
    { name: 'Nissan 300ZX Twin Turbo', cardNumber: '023' },
    { name: 'Corvette Grand Sport Roadster', cardNumber: '037' },
    { name: 'Rodger Dodger', cardNumber: '073' },
    { name: "'95 Mazda RX-7", cardNumber: '088' },
    { name: 'Corvette C7 Z06 Convertible', cardNumber: '114' },
    { name: 'Mazda RX-3', cardNumber: '137' },
    { name: '2020 Ford Mustang Shelby GT500', cardNumber: '143' },
    { name: "'71 Datsun 510", cardNumber: '162' },
    { name: '2018 Honda Civic Type R', cardNumber: '186' },
    { name: "'68 Mercury Cougar", cardNumber: '207' },
    { name: '2019 Audi R8 Spyder', cardNumber: '211' },
    { name: "'49 Ford F1", cardNumber: '225' },
    { name: 'Porsche 356 Outlaw', cardNumber: '171' },
    { name: "'64 Nova Wagon Gasser", cardNumber: '232' },
    { name: 'Shelby Cobra 427 S/C', cardNumber: '250' },
  ];

  console.log('Checking STH models in database:\n');

  for (const expected of expectedSTHModels) {
    const variants = await prisma.variant.findMany({
      where: {
        year: 2021,
        cardNumber: expected.cardNumber,
        model: {
          castingName: expected.name,
        },
      },
      include: {
        model: true,
      },
    });

    console.log(`${expected.name} (Card #${expected.cardNumber}):`);
    console.log(`  Total variants: ${variants.length}`);

    variants.forEach((v) => {
      console.log(
        `    - Variant ID: ${v.id}, Color: ${v.color || 'null'}, STH: ${v.isSuperTreasureHunt}, TH: ${v.isTreasureHunt}, Toy#: ${v.model.castingId}`
      );
    });

    const sthVariants = variants.filter((v) => v.isSuperTreasureHunt);
    const thVariants = variants.filter((v) => v.isTreasureHunt && !v.isSuperTreasureHunt);

    if (sthVariants.length === 0 && thVariants.length > 0) {
      console.log(`  ⚠️  WARNING: Expected STH but found TH instead!`);
    } else if (sthVariants.length === 0) {
      console.log(`  ❌ No STH variant found`);
    } else {
      console.log(`  ✅ Found ${sthVariants.length} STH variant(s)`);
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















