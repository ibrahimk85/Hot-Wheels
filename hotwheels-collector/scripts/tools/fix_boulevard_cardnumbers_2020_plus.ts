import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 2021/2022: legacy rows were imported with Toy # in cardNumber and collide
  // with correct variants imported later. Remove the legacy duplicates.
  await prisma.variant.deleteMany({
    where: {
      id: { in: [8485, 8493] },
    },
  });

  // 2024: remove "No #" variants requested for cleanup
  await prisma.variant.deleteMany({
    where: {
      id: { in: [8654, 8655, 8656, 8657, 8658] },
    },
  });

  // 2026: remove duplicate rows where cardNumber stored as Toy # (JHWxx).
  // Correct numeric rows (141-150) already exist as separate variants.
  const duplicateBadIds = [8594, 8595, 8596, 8597, 8598, 8599, 8600, 8601, 8602, 8603];
  await prisma.variant.deleteMany({
    where: { id: { in: duplicateBadIds } },
  });

  console.log('Boulevard cardnumber fixes applied.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

