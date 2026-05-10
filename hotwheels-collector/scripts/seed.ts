import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 2025 yılını kontrol et, yoksa oluştur
  let year2025 = await prisma.year.findFirst({
    where: { year: 2025 },
  });

  if (!year2025) {
    year2025 = await prisma.year.create({
      data: {
        year: 2025,
        notes: '2025 Hot Wheels koleksiyonu',
      },
    });
    console.log('✓ 2025 yılı oluşturuldu:', year2025);
  } else {
    console.log('✓ 2025 yılı zaten mevcut:', year2025);
  }

  // Mainline koleksiyonunu kontrol et, yoksa oluştur
  let mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      yearId: year2025.id,
    },
  });

  if (!mainlineCollection) {
    mainlineCollection = await prisma.collection.create({
      data: {
        name: 'Mainline',
        code: 'HW Mainline',
        yearId: year2025.id,
      },
    });
    console.log('✓ Mainline koleksiyonu oluşturuldu:', mainlineCollection);
  } else {
    console.log('✓ Mainline koleksiyonu zaten mevcut:', mainlineCollection);
  }

  // Hot Wheels Themed Multipack koleksiyonlarını 2022-2026 için oluştur
  const themedYears = [2022, 2023, 2024, 2025, 2026];
  const themedCollectionsByYear: Record<number, { id: number }> = {};

  for (const yearValue of themedYears) {
    let year = await prisma.year.findFirst({
      where: { year: yearValue },
    });

    if (!year) {
      year = await prisma.year.create({
        data: {
          year: yearValue,
          notes: `${yearValue} Hot Wheels koleksiyonu`,
        },
      });
      console.log(`✓ ${yearValue} yılı oluşturuldu:`, year);
    }

    let themedCollection = await prisma.collection.findFirst({
      where: {
        name: 'Hot Wheels Themed Multipack',
        yearId: year.id,
      },
    });

    if (!themedCollection) {
      themedCollection = await prisma.collection.create({
        data: {
          name: 'Hot Wheels Themed Multipack',
          code: 'THMP',
          yearId: year.id,
        },
      });
      console.log(
        `✓ Hot Wheels Themed Multipack koleksiyonu oluşturuldu (${yearValue}):`,
        themedCollection,
      );
    } else {
      console.log(
        `✓ Hot Wheels Themed Multipack koleksiyonu zaten mevcut (${yearValue}):`,
        themedCollection,
      );
    }

    themedCollectionsByYear[yearValue] = { id: themedCollection.id };
  }

  // Örnek birkaç Themed Multipack kaydı (araçlar manuel olarak daha sonra bağlanabilir)
  const multipackSeeds: Array<{
    year: number;
    packageCode: string;
    themeName: string;
  }> = [
    { year: 2024, packageCode: 'HRX54', themeName: 'Japanese Car Culture' },
    { year: 2024, packageCode: 'HRX56', themeName: 'European Car Culture' },
    { year: 2024, packageCode: 'HRX57', themeName: 'ZAMAC' },
    { year: 2025, packageCode: 'JBY77', themeName: 'Japanese Car Culture' },
    { year: 2025, packageCode: 'JBY79', themeName: 'European Car Culture' },
    { year: 2025, packageCode: 'JBY80', themeName: 'ZAMAC' },
  ];

  for (const seed of multipackSeeds) {
    const themedCollection = themedCollectionsByYear[seed.year];
    if (!themedCollection) continue;

    const existing = await prisma.themedMultipack.findFirst({
      where: {
        collectionId: themedCollection.id,
        packageCode: seed.packageCode,
      },
    });

    if (existing) {
      console.log(
        `✓ Themed multipack zaten mevcut (${seed.year} ${seed.packageCode}):`,
        existing.id,
      );
      continue;
    }

    const created = await prisma.themedMultipack.create({
      data: {
        collectionId: themedCollection.id,
        year: seed.year,
        packageCode: seed.packageCode,
        themeName: seed.themeName,
        displayName: `${seed.themeName} Themed Multipack (${seed.year})`,
      },
    });

    console.log(
      `✓ Themed multipack oluşturuldu (${seed.year} ${seed.packageCode}):`,
      created.id,
    );
  }

  console.log('\n✅ Seed işlemi tamamlandı!');
}

main()
  .catch((e) => {
    console.error('❌ Seed işlemi başarısız:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

