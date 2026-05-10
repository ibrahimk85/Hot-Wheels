/**
 * Seed Script: Hot Wheels Silver Series - Boş Koleksiyon Kurulumu
 *
 * Hot Wheels Silver Series (Themed Assortment) koleksiyonunu oluşturur.
 * Simdilik içi boş - yıl ve alt seri verileri sonra import scriptleri ile eklenecek.
 *
 * Yapı: Year → Collection (Hot Wheels Silver Series) → [SubSeries] → [Model] → [Variant]
 *
 * Çalıştırma: npx ts-node scripts/seed_hot_wheels_silver_series.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COLLECTION_NAME = 'Hot Wheels Silver Series';
const YEARS = [2023, 2024, 2025, 2026]; // Themed assortment / Silver Label / Silver Series yılları

async function main() {
  console.log(`\n=== Hot Wheels Silver Series Koleksiyon Kurulumu ===\n`);

  for (const yearNum of YEARS) {
    // Yıl var mı kontrol et, yoksa oluştur
    let year = await prisma.year.findFirst({
      where: { year: yearNum },
    });

    if (!year) {
      year = await prisma.year.create({
        data: {
          year: yearNum,
          notes: `${yearNum} Hot Wheels koleksiyonu`,
        },
      });
      console.log(`✓ ${yearNum} yılı oluşturuldu`);
    } else {
      console.log(`✓ ${yearNum} yılı zaten mevcut`);
    }

    // Hot Wheels Silver Series koleksiyonu var mı kontrol et
    const existing = await prisma.collection.findFirst({
      where: {
        name: COLLECTION_NAME,
        yearId: year.id,
      },
    });

    if (!existing) {
      await prisma.collection.create({
        data: {
          name: COLLECTION_NAME,
          code: 'Silver Series',
          yearId: year.id,
        },
      });
      console.log(`✓ ${COLLECTION_NAME} koleksiyonu oluşturuldu (${yearNum})`);
    } else {
      console.log(`✓ ${COLLECTION_NAME} koleksiyonu zaten mevcut (${yearNum})`);
    }
  }

  console.log(`\n✅ Hot Wheels Silver Series kurulumu tamamlandı!`);
  console.log(`   Koleksiyonlar: /collections/hot-wheels-silver-series`);
  console.log(`   Varyantlar filtrelerinde görünecek.`);
}

main()
  .catch((e) => {
    console.error('❌ Kurulum başarısız:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
