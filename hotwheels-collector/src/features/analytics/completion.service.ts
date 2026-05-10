import prisma from '@/db';

export interface CompletionStats {
  collectionId: number;
  collectionName: string;
  year: number;
  totalModels: number;
  ownedModels: number;
  completionPercent: number;
  missingModels: number;
}

/**
 * Koleksiyon tamamlanma oranı
 */
export async function getCollectionCompletion(
  collectionId?: number
): Promise<CompletionStats[]> {
  const whereClause: any = {};
  if (collectionId) {
    whereClause.id = collectionId;
  }

  const collections = await prisma.collection.findMany({
    where: whereClause,
    include: {
      models: true,
      year: true,
    },
  });

  return collections.map((collection) => {
    const totalModels = collection.models.length;
    const ownedModels = collection.models.filter((m) => m.owned).length;
    const completionPercent =
      totalModels > 0 ? (ownedModels / totalModels) * 100 : 0;
    const missingModels = totalModels - ownedModels;

    return {
      collectionId: collection.id,
      collectionName: collection.name,
      year: collection.year.year,
      totalModels,
      ownedModels,
      completionPercent,
      missingModels,
    };
  });
}

/**
 * Genel tamamlanma oranı
 */
export async function getOverallCompletion(): Promise<{
  totalCollections: number;
  completedCollections: number;
  averageCompletion: number;
  totalModels: number;
  ownedModels: number;
  overallCompletionPercent: number;
}> {
  const collections = await prisma.collection.findMany({
    include: {
      models: true,
    },
  });

  const totalCollections = collections.length;
  let completedCollections = 0;
  let totalModels = 0;
  let ownedModels = 0;
  let totalCompletion = 0;

  for (const collection of collections) {
    const total = collection.models.length;
    const owned = collection.models.filter((m) => m.owned).length;

    totalModels += total;
    ownedModels += owned;

    if (total > 0) {
      const completion = (owned / total) * 100;
      totalCompletion += completion;

      if (completion === 100) {
        completedCollections += 1;
      }
    }
  }

  const averageCompletion =
    totalCollections > 0 ? totalCompletion / totalCollections : 0;
  const overallCompletionPercent =
    totalModels > 0 ? (ownedModels / totalModels) * 100 : 0;

  return {
    totalCollections,
    completedCollections,
    averageCompletion,
    totalModels,
    ownedModels,
    overallCompletionPercent,
  };
}

/**
 * Yıllara göre tamamlanma oranı
 */
export async function getCompletionByYear(): Promise<
  Array<{ year: number; total: number; owned: number; completionPercent: number }>
> {
  const collections = await prisma.collection.findMany({
    include: {
      models: true,
      year: true,
    },
  });

  const byYear = new Map<
    number,
    { total: number; owned: number }
  >();

  for (const collection of collections) {
    const year = collection.year.year;
    const total = collection.models.length;
    const owned = collection.models.filter((m) => m.owned).length;

    if (!byYear.has(year)) {
      byYear.set(year, { total: 0, owned: 0 });
    }

    const current = byYear.get(year)!;
    current.total += total;
    current.owned += owned;
  }

  return Array.from(byYear.entries())
    .map(([year, data]) => ({
      year,
      ...data,
      completionPercent: data.total > 0 ? (data.owned / data.total) * 100 : 0,
    }))
    .sort((a, b) => a.year - b.year);
}



