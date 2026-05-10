import prisma from '@/db';

// Tüm koleksiyonları listele
export async function getCollections() {
  return prisma.collection.findMany({
    include: {
      year: true,        // koleksiyonun ait olduğu yıl
      subSeries: true,   // alt seriler
      models: true       // bu koleksiyondaki modeller
    }
  });
}

// Tek bir koleksiyonu id ile getir
export async function getCollectionById(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new Error('Invalid collection ID');
  }

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      year: true,
      subSeries: true,
      models: {
        include: {
          variants: {
            include: {
              images: {
                orderBy: { id: 'asc' },
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!collection) {
    throw new Error('Collection not found');
  }

  return collection;
}

// Yeni koleksiyon oluştur
export async function createCollection(data: {
  name: string;
  code?: string;
  yearId: number;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify year exists
    const year = await tx.year.findUnique({
      where: { id: data.yearId },
    });
    
    if (!year) {
      throw new Error('Year not found');
    }

    // Create collection
    return tx.collection.create({ data });
  });
}

// Koleksiyonu güncelle
export async function updateCollection(id: number, data: {
  name?: string;
  code?: string;
  yearId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify collection exists
    const existing = await tx.collection.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Collection not found');
    }

    // Verify year exists if provided
    if (data.yearId) {
      const year = await tx.year.findUnique({
        where: { id: data.yearId },
      });
      
      if (!year) {
        throw new Error('Year not found');
      }
    }

    // Update collection
    return tx.collection.update({
      where: { id },
      data
    });
  });
}

// Koleksiyonu sil
export async function deleteCollection(id: number) {
  return prisma.$transaction(async (tx) => {
    // Verify collection exists and get related data
    const existing = await tx.collection.findUnique({
      where: { id },
      include: {
        subSeries: {
          include: {
            models: {
              include: {
                variants: {
                  include: { images: true },
                },
                images: true,
              },
            },
          },
        },
      },
    });
    
    if (!existing) {
      throw new Error('Collection not found');
    }

    // Delete all related data
    for (const subSeries of existing.subSeries) {
      for (const model of subSeries.models) {
        // Delete model images
        if (model.images.length > 0) {
          await tx.image.deleteMany({
            where: { modelId: model.id },
          });
        }

        // Delete variant images
        for (const variant of model.variants) {
          if (variant.images.length > 0) {
            await tx.image.deleteMany({
              where: { variantId: variant.id },
            });
          }
        }

        // Delete variants
        if (model.variants.length > 0) {
          await tx.variant.deleteMany({
            where: { modelId: model.id },
          });
        }
      }

      // Delete models
      if (subSeries.models.length > 0) {
        await tx.model.deleteMany({
          where: { subSeriesId: subSeries.id },
        });
      }
    }

    // Delete subSeries
    if (existing.subSeries.length > 0) {
      await tx.subSeries.deleteMany({
        where: { collectionId: id },
      });
    }

    // Delete collection
    return tx.collection.delete({ where: { id } });
  });
}

