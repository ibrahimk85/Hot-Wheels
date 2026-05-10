/**
 * Pearl&Chrome Anniversary Series koleksiyonunu tamamen siler.
 * Tüm yıllardaki (2018–2026) aynı isimli koleksiyon kayıtları, alt serileri, modelleri ve varyantları silinir.
 * Dashboard, Variants ve Collections sayfalarından bu koleksiyon kalkar (veri tek kaynak: DB).
 *
 * Kullanım: npx ts-node scripts/tools/delete_pearl_chrome_anniversary_collection.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const COLLECTION_NAME = 'Pearl&Chrome Anniversary Series';
const prisma = new PrismaClient();

async function deleteOneCollection(collectionId: number, collectionLabel: string) {
  const modelIds = await prisma.model.findMany({
    where: { collectionId },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const variantIds = await prisma.variant.findMany({
    where: { modelId: { in: modelIds } },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const subSeriesRows = await prisma.subSeries.findMany({
    where: { collectionId },
    select: { id: true },
  });
  const subSeriesIds = subSeriesRows.map((r) => r.id);

  if (modelIds.length > 0 || variantIds.length > 0) {
    await prisma.priceAlert.deleteMany({
      where: {
        OR: [
          ...(variantIds.length ? [{ variantId: { in: variantIds } }] : []),
          ...(modelIds.length ? [{ modelId: { in: modelIds } }] : []),
        ],
      },
    });
  }

  if (modelIds.length > 0 || variantIds.length > 0) {
    await prisma.image.deleteMany({
      where: {
        OR: [
          ...(variantIds.length ? [{ variantId: { in: variantIds } }] : []),
          ...(modelIds.length ? [{ modelId: { in: modelIds } }] : []),
        ],
      },
    });
  }

  await prisma.variant.deleteMany({
    where: { modelId: { in: modelIds } },
  });

  await prisma.model.deleteMany({
    where: { collectionId },
  });

  await prisma.releaseDate.deleteMany({
    where: {
      OR: [
        { collectionId },
        { subSeriesId: { in: subSeriesIds } },
      ],
    },
  });

  await prisma.subSeries.deleteMany({
    where: { collectionId },
  });

  // ThemedMultipack bazen Prisma client'ta olmayabiliyor; raw SQL ile sil
  try {
    const multipackIds = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM ThemedMultipack WHERE collectionId = ${collectionId}
    `;
    const ids = multipackIds.map((r) => r.id);
    if (ids.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ThemedMultipackItem WHERE multipackId IN (${ids.join(',')})`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ThemedMultipack WHERE collectionId = ${collectionId}`
      );
    }
  } catch {
    // Tablo yoksa veya client'ta yoksa atla
  }

  await prisma.collectionHistory.deleteMany({
    where: { collectionId },
  });

  await prisma.goal.deleteMany({
    where: { targetId: collectionId },
  });

  await prisma.userCollection.deleteMany({
    where: { collectionId },
  });

  await prisma.collection.delete({
    where: { id: collectionId },
  });

  console.log(
    `  Silindi: ${collectionLabel} (id=${collectionId}) → ${modelIds.length} model, ${variantIds.length} varyant`
  );
}

async function main() {
  console.log(`=== "${COLLECTION_NAME}" koleksiyonu tamamen siliniyor ===\n`);

  const collections = await prisma.collection.findMany({
    where: { name: COLLECTION_NAME },
    include: { year: true },
    orderBy: { yearId: 'asc' },
  });

  if (collections.length === 0) {
    console.log(`"${COLLECTION_NAME}" adında koleksiyon bulunamadı. Çıkılıyor.`);
    return;
  }

  console.log(`Bulunan kayıt sayısı: ${collections.length} (yıllar: ${collections.map((c) => c.year.year).join(', ')})\n`);

  for (const c of collections) {
    await deleteOneCollection(c.id, `${c.name} (${c.year.year})`);
  }

  console.log(`\n✅ "${COLLECTION_NAME}" koleksiyonu ve tüm alt seri/model/varyant kayıtları silindi.`);
  console.log('   Dashboard, Variants ve Collections sayfalarından kalkmış olmalı.');
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
