import prisma from '@/db';

export interface UserCollectionData {
  id: number;
  userId: number;
  collectionId: number;
  isDefault: boolean;
  createdAt: Date;
  collection: {
    id: number;
    name: string;
    code: string | null;
    year: {
      id: number;
      year: number;
    };
  };
}

/**
 * Kullanıcının koleksiyonlarını getir
 */
export async function getUserCollections(
  userId: number
): Promise<UserCollectionData[]> {
  const userCollections = await prisma.userCollection.findMany({
    where: { userId },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return userCollections.map((uc) => ({
    id: uc.id,
    userId: uc.userId,
    collectionId: uc.collectionId,
    isDefault: uc.isDefault,
    createdAt: uc.createdAt,
    collection: {
      id: uc.collection.id,
      name: uc.collection.name,
      code: uc.collection.code,
      year: {
        id: uc.collection.year.id,
        year: uc.collection.year.year,
      },
    },
  }));
}

/**
 * Kullanıcıya koleksiyon ekle
 */
export async function addCollectionToUser(
  userId: number,
  collectionId: number,
  isDefault: boolean = false
): Promise<UserCollectionData> {
  // Eğer default ise, diğer default'ları kaldır
  if (isDefault) {
    await prisma.userCollection.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  const userCollection = await prisma.userCollection.create({
    data: {
      userId,
      collectionId,
      isDefault,
    },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
  });

  return {
    id: userCollection.id,
    userId: userCollection.userId,
    collectionId: userCollection.collectionId,
    isDefault: userCollection.isDefault,
    createdAt: userCollection.createdAt,
    collection: {
      id: userCollection.collection.id,
      name: userCollection.collection.name,
      code: userCollection.collection.code,
      year: {
        id: userCollection.collection.year.id,
        year: userCollection.collection.year.year,
      },
    },
  };
}

/**
 * Kullanıcıdan koleksiyon kaldır
 */
export async function removeCollectionFromUser(
  userId: number,
  collectionId: number
): Promise<void> {
  await prisma.userCollection.deleteMany({
    where: {
      userId,
      collectionId,
    },
  });
}

/**
 * Varsayılan koleksiyonu ayarla
 */
export async function setDefaultCollection(
  userId: number,
  collectionId: number
): Promise<void> {
  // Tüm default'ları kaldır
  await prisma.userCollection.updateMany({
    where: {
      userId,
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  });

  // Yeni default'u ayarla
  await prisma.userCollection.updateMany({
    where: {
      userId,
      collectionId,
    },
    data: {
      isDefault: true,
    },
  });
}

/**
 * Koleksiyon senkronizasyonu (basit versiyon - JSON export/import)
 */
export async function exportUserCollection(userId: number): Promise<any> {
  const userCollections = await getUserCollections(userId);
  
  // Kullanıcının sahip olduğu modelleri ve varyantları al
  const collections = userCollections.map((uc) => uc.collectionId);
  
  const models = await prisma.model.findMany({
    where: {
      collectionId: { in: collections },
      owned: true,
    },
    include: {
      variants: {
        where: { owned: true },
        include: {
          images: true,
        },
      },
      images: true,
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
    },
  });

  return {
    userCollections,
    models,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Koleksiyon geçmişi kaydet
 */
export async function logCollectionHistory(
  userId: number,
  data: {
    collectionId?: number;
    action: string;
    entityType: string;
    entityId?: number;
    changes?: Record<string, any>;
  }
): Promise<void> {
  const createData: any = {
    userId,
    collectionId: data.collectionId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
  };

  if (data.changes) {
    createData.changes = JSON.stringify(data.changes);
  }

  await prisma.collectionHistory.create({
    data: createData,
  });
}

/**
 * Koleksiyon geçmişini getir
 */
export async function getCollectionHistory(
  userId: number,
  limit: number = 50
): Promise<any[]> {
  const history = await prisma.collectionHistory.findMany({
    where: { userId },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return history.map((h) => ({
    ...h,
    changes: h.changes ? JSON.parse(h.changes) : null,
  }));
}

