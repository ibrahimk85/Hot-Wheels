import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const models = await prisma.model.findMany({
    where: {
      collection: {
        name: 'Boulevard',
        year: { year: 2024 },
      },
    },
    include: {
      variants: { include: { images: true } },
      images: true,
      subSeries: true,
    },
    orderBy: { castingName: 'asc' },
  });

  const noImg = models.filter(
    (m) => m.images.length === 0 && m.variants.every((v) => v.images.length === 0)
  );

  const result = {
    total: models.length,
    withoutImages: noImg.length,
    models: noImg.map((m) => ({
      id: m.id,
      name: m.castingName,
      subSeries: m.subSeries?.name || null,
      variants: m.variants.map((v) => ({
        id: v.id,
        year: v.year,
        cardNumber: v.cardNumber,
      })),
    })),
  };

  fs.writeFileSync('result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);


