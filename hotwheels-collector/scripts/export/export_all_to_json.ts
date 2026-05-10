// scripts/export/export_all_to_json.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const [years, collections, subSeries, models, variants, images] = await Promise.all([
    prisma.year.findMany(),
    prisma.collection.findMany(),
    prisma.subSeries.findMany(),
    prisma.model.findMany(),
    prisma.variant.findMany(),
    prisma.image.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    years,
    collections,
    subSeries,
    models,
    variants,
    images,
  };

  const outDir = path.join(process.cwd(), 'exports');
  await fs.promises.mkdir(outDir, { recursive: true });

  const filePath = path.join(outDir, `hotwheels_backup.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`JSON backup created: ${filePath}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });












