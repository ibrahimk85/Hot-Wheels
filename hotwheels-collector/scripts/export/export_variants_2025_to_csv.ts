// scripts/export/export_variants_2025_to_csv.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const year = 2025; // gerekirse değiştir

  const variants = await prisma.variant.findMany({
    where: { year },
    include: {
      model: {
        include: {
          subSeries: {
            include: {
              collection: true,
            },
          },
        },
      },
    },
    orderBy: {
      cardNumber: 'asc',
    },
  });

  const lines: string[] = [];
  lines.push(
    [
      'year',
      'collection',
      'subSeries',
      'cardNumber',
      'castingName',
      'toyNumber',
      'color',
      'releaseName',
      'isTreasureHunt',
      'isSuperTreasureHunt',
      'owned',
      'wishlisted',
      'quantity',
      'condition',
      'notes',
    ].join(';')
  );

  for (const v of variants as any[]) {
    const model = v.model;
    const subSeries = model?.subSeries;
    const collection = subSeries?.collection;

    const row = [
      v.year ?? '',
      collection?.name ?? '',
      subSeries?.name ?? '',
      v.cardNumber ?? '',
      model?.castingName ?? '',
      model?.castingId ?? '',
      v.color ?? '',
      v.releaseName ?? '',
      v.isTreasureHunt ? '1' : '0',
      v.isSuperTreasureHunt ? '1' : '0',
      v.owned ? '1' : '0',
      v.wishlisted ? '1' : '0',
      v.quantity ?? '',
      v.condition ?? '',
      (v.notes ?? '').replace(/(\r\n|\n|\r)/g, ' '),
    ];
    lines.push(row.join(';'));
  }

  const outDir = path.join(process.cwd(), 'exports');
  await fs.promises.mkdir(outDir, { recursive: true });

  const filePath = path.join(outDir, `variants_${year}_mainline.csv`);
  await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

  console.log(`CSV export created: ${filePath}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });












