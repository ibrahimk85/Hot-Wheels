import prisma from '@/db';
import { getPackedMarketPrice, getLooseMarketPrice, getMarketPrice } from '@/features/analytics/price-helper';

export interface SummaryReportData {
  totalModels: number;
  totalVariants: number;
  ownedVariants: number;
  wishlistCount: number;
  totalValue: {
    packed: number;
    loose: number;
    total: number;
  };
  collections: Array<{
    name: string;
    year: number;
    variantCount: number;
    ownedCount: number;
  }>;
  years: Array<{
    year: number;
    variantCount: number;
    ownedCount: number;
  }>;
}

export interface CollectionReportData {
  collectionName: string;
  year: number;
  totalModels: number;
  ownedModels: number;
  missingModels: number;
  totalVariants: number;
  ownedVariants: number;
  totalValue: {
    packed: number;
    loose: number;
    total: number;
  };
  models: Array<{
    id: number;
    castingName: string;
    castingId: string | null;
    owned: boolean;
    wishlisted: boolean;
    packedPrice: number | null;
    loosePrice: number | null;
    variantCount: number;
  }>;
}

export interface YearReportData {
  year: number;
  totalModels: number;
  ownedModels: number;
  totalVariants: number;
  ownedVariants: number;
  collections: Array<{
    name: string;
    variantCount: number;
    ownedCount: number;
  }>;
  totalValue: {
    packed: number;
    loose: number;
    total: number;
  };
}

export interface ValueReportData {
  totalValue: {
    packed: number;
    loose: number;
    total: number;
  };
  byCollection: Array<{
    name: string;
    year: number;
    value: number;
    variantCount: number;
  }>;
  byYear: Array<{
    year: number;
    value: number;
    variantCount: number;
  }>;
  topValuableModels: Array<{
    id: number;
    castingName: string;
    value: number;
    owned: boolean;
  }>;
}

export interface MissingModelsReportData {
  collectionName?: string;
  year?: number;
  missingModels: Array<{
    id: number;
    castingName: string;
    castingId: string | null;
    subSeriesName: string;
    collectionName: string;
    year: number;
    variantCount: number;
  }>;
  totalMissing: number;
}

/**
 * Genel özet raporu
 */
export async function getSummaryReport(
  year?: number
): Promise<SummaryReportData> {
  const yearFilter = year ? { year } : {};

  // Year varsa önce yearId'yi bul
  let yearId: number | undefined;
  if (year) {
    const yearRecord = await prisma.year.findFirst({
      where: { year },
      select: { id: true },
    });
    yearId = yearRecord?.id;
  }

  const [
    totalModels,
    totalVariants,
    ownedVariants,
    wishlistCount,
    collections,
    years,
    models,
  ] = await Promise.all([
    prisma.model.count({
      where: year
        ? {
            variants: {
              some: {
                year: year,
              },
            },
          }
        : {},
    }),
    prisma.variant.count({ where: yearFilter }),
    prisma.variant.count({ where: { ...yearFilter, owned: true } }),
    prisma.model.count({
      where: {
        wishlisted: true,
        ...(year
          ? {
              variants: {
                some: {
                  year: year,
                },
              },
            }
          : {}),
      },
    }),
    yearId
      ? prisma.collection.findMany({
          where: { yearId },
          include: {
            year: true,
            models: {
              include: {
                variants: {
                  where: yearFilter,
                },
              },
            },
          },
        })
      : prisma.collection.findMany({
          include: {
            year: true,
            models: {
              include: {
                variants: true,
              },
            },
          },
        }),
    prisma.year.findMany({
      include: {
        collections: {
          include: {
            models: {
              include: {
                variants: true,
              },
            },
          },
        },
      },
    }),
    prisma.model.findMany({
      where: {
        owned: true,
        ...(year
          ? {
              variants: {
                some: {
                  year: year,
                },
              },
            }
          : {}),
      },
      select: {
        packedPrice: true,
        loosePrice: true,
      },
    }),
  ]);

  const totalValue = {
      packed: models.reduce((sum, m) => sum + getPackedMarketPrice(m), 0),
      loose: models.reduce((sum, m) => sum + getLooseMarketPrice(m), 0),
      total: models.reduce((sum, m) => sum + getMarketPrice(m), 0),
  };

  return {
    totalModels,
    totalVariants,
    ownedVariants,
    wishlistCount,
    totalValue,
    collections: collections.map((c) => {
      const allVariants = c.models.flatMap((m) => m.variants);
      return {
        name: c.name,
        year: c.year.year,
        variantCount: allVariants.length,
        ownedCount: allVariants.filter((v) => v.owned).length,
      };
    }),
    years: years.map((y) => {
      const allVariants = y.collections.flatMap((c) =>
        c.models.flatMap((m) => m.variants)
      );
      return {
        year: y.year,
        variantCount: allVariants.length,
        ownedCount: allVariants.filter((v) => v.owned).length,
      };
    }),
  };
}

/**
 * Koleksiyon raporu
 */
export async function getCollectionReport(
  collectionId: number
): Promise<CollectionReportData | null> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      year: true,
      models: {
        include: {
          variants: true,
        },
      },
    },
  });

  if (!collection) {
    return null;
  }

  const totalModels = collection.models.length;
  const ownedModels = collection.models.filter((m) => m.owned).length;
  const missingModels = totalModels - ownedModels;

  const allVariants = collection.models.flatMap((m) => m.variants);
  const totalVariants = allVariants.length;
  const ownedVariants = allVariants.filter((v) => v.owned).length;

  const totalValue = {
    packed: collection.models.reduce(
      (sum, m) => sum + (m.packedPrice || 0),
      0
    ),
    loose: collection.models.reduce(
      (sum, m) => sum + (m.loosePrice || 0),
      0
    ),
    total: collection.models.reduce(
      (sum, m) => sum + Math.max(m.packedPrice || 0, m.loosePrice || 0),
      0
    ),
  };

  return {
    collectionName: collection.name,
    year: collection.year.year,
    totalModels,
    ownedModels,
    missingModels,
    totalVariants,
    ownedVariants,
    totalValue,
    models: collection.models.map((m) => ({
      id: m.id,
      castingName: m.castingName,
      castingId: m.castingId,
      owned: m.owned,
      wishlisted: m.wishlisted,
      packedPrice: m.packedPrice,
      loosePrice: m.loosePrice,
      variantCount: m.variants.length,
    })),
  };
}

/**
 * Yıl raporu
 */
export async function getYearReport(year: number): Promise<YearReportData | null> {
  const yearData = await prisma.year.findFirst({
    where: { year },
    include: {
      collections: {
        include: {
          models: {
            include: {
              variants: true,
            },
          },
        },
      },
    },
  });

  if (!yearData) {
    return null;
  }

  const allModels = yearData.collections.flatMap((c) => c.models);
  const totalModels = allModels.length;
  const ownedModels = allModels.filter((m) => m.owned).length;

  const allVariants = allModels.flatMap((m) => m.variants);
  const totalVariants = allVariants.length;
  const ownedVariants = allVariants.filter((v) => v.owned).length;

  const totalValue = {
    packed: allModels.reduce((sum, m) => sum + (m.packedPrice || 0), 0),
    loose: allModels.reduce((sum, m) => sum + (m.loosePrice || 0), 0),
    total: allModels.reduce(
      (sum, m) => sum + Math.max(m.packedPrice || 0, m.loosePrice || 0),
      0
    ),
  };

  return {
    year,
    totalModels,
    ownedModels,
    totalVariants,
    ownedVariants,
    collections: yearData.collections.map((c) => {
      const variants = c.models.flatMap((m) => m.variants);
      return {
        name: c.name,
        variantCount: variants.length,
        ownedCount: variants.filter((v) => v.owned).length,
      };
    }),
    totalValue,
  };
}

/**
 * Değer analizi raporu
 */
export async function getValueReport(
  year?: number
): Promise<ValueReportData> {
  const whereClause = year
    ? {
        owned: true,
        variants: {
          some: {
            year: year,
          },
        },
      }
    : { owned: true };

  const models = await prisma.model.findMany({
    where: whereClause,
    include: {
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
      variants: {
        where: year ? { year } : {},
      },
    },
  });

  const totalValue = {
      packed: models.reduce((sum, m) => sum + getPackedMarketPrice(m), 0),
      loose: models.reduce((sum, m) => sum + getLooseMarketPrice(m), 0),
      total: models.reduce((sum, m) => sum + getMarketPrice(m), 0),
  };

  // Koleksiyon bazında değer
  const byCollectionMap = new Map<string, { value: number; variantCount: number }>();
  models.forEach((m) => {
    const collectionName = m.subSeries?.collection.name || 'Unknown';
    const key = `${collectionName}-${m.subSeries?.collection.year.year}`;
    const value = getMarketPrice(m);
    const variantCount = m.variants.length;

    if (!byCollectionMap.has(key)) {
      byCollectionMap.set(key, { value: 0, variantCount: 0 });
    }
    const existing = byCollectionMap.get(key)!;
    existing.value += value;
    existing.variantCount += variantCount;
  });

  const byCollection = Array.from(byCollectionMap.entries()).map(([key, data]) => {
    const [name, yearStr] = key.split('-');
    return {
      name,
      year: Number(yearStr),
      value: data.value,
      variantCount: data.variantCount,
    };
  });

  // Yıl bazında değer
  const byYearMap = new Map<number, { value: number; variantCount: number }>();
  models.forEach((m) => {
    const year = m.subSeries?.collection.year.year || 0;
    const value = getMarketPrice(m);
    const variantCount = m.variants.length;

    if (!byYearMap.has(year)) {
      byYearMap.set(year, { value: 0, variantCount: 0 });
    }
    const existing = byYearMap.get(year)!;
    existing.value += value;
    existing.variantCount += variantCount;
  });

  const byYear = Array.from(byYearMap.entries())
    .map(([year, data]) => ({
      year,
      value: data.value,
      variantCount: data.variantCount,
    }))
    .sort((a, b) => b.year - a.year);

  // En değerli modeller
  const topValuableModels = models
    .map((m) => ({
      id: m.id,
      castingName: m.castingName,
      value: Math.max(m.packedPrice || 0, m.loosePrice || 0),
      owned: m.owned,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  return {
    totalValue,
    byCollection,
    byYear,
    topValuableModels,
  };
}

/**
 * Eksik modeller raporu
 */
export async function getMissingModelsReport(
  collectionId?: number,
  year?: number
): Promise<MissingModelsReportData> {
  const whereClause: any = {
    owned: false,
  };

  if (collectionId) {
    whereClause.collectionId = collectionId;
  }

  if (year) {
    const yearRecord = await prisma.year.findFirst({
      where: { year },
      select: { id: true },
    });
    if (yearRecord) {
      whereClause.subSeries = {
        collection: {
          yearId: yearRecord.id,
        },
      };
    } else {
      // Year bulunamazsa boş sonuç döndür
      return {
        collectionName: collectionId
          ? (await prisma.collection.findUnique({
              where: { id: collectionId },
              select: { name: true },
            }))?.name
          : undefined,
        year,
        missingModels: [],
        totalMissing: 0,
      };
    }
  }

  const missingModels = await prisma.model.findMany({
    where: whereClause,
    include: {
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
      variants: true,
    },
  });

  const collection = collectionId
    ? await prisma.collection.findUnique({
        where: { id: collectionId },
        select: { name: true },
      })
    : null;

  return {
    collectionName: collection?.name,
    year,
    missingModels: missingModels.map((m) => ({
      id: m.id,
      castingName: m.castingName,
      castingId: m.castingId,
      subSeriesName: m.subSeries?.name || 'Unknown',
      collectionName: m.subSeries?.collection.name || 'Unknown',
      year: m.subSeries?.collection.year.year || 0,
      variantCount: m.variants.length,
    })),
    totalMissing: missingModels.length,
  };
}

export interface VariantExcelData {
  toyNumber: string | null;
  colNumber: string | null;
  modelName: string;
  series: string | null;
  seriesNumber: string | null;
  photoThumbnail: string | null;
}/**
 * Get variants for Excel export
 */
export async function getVariantsForExcelExport(
  filters: {
    owned?: boolean | 'all';
    year?: number;
    collectionId?: number;
  }
): Promise<Array<VariantExcelData & { id: number }>> {
  const whereClause: any = {};  // Use packedOwned for filtering (new system), fallback to owned for backward compatibility
  if (filters.owned !== undefined && filters.owned !== 'all') {
    // Filter by packedOwned (new field), but also check owned for backward compatibility
    if (filters.owned === false) {
      // For "not owned", check both packedOwned = false OR (owned = false AND packedOwned is null)
      whereClause.OR = [
        { packedOwned: false },
        {
          AND: [
            { owned: false },
            { packedOwned: null },
          ],
        },
      ];
    } else {
      // For "owned", check both packedOwned = true OR (owned = true AND packedOwned is null)
      whereClause.OR = [
        { packedOwned: true },
        {
          AND: [
            { owned: true },
            { packedOwned: null },
          ],
        },
      ];
    }
  }  if (filters.year) {
    whereClause.year = filters.year;
  }  if (filters.collectionId) {
    whereClause.model = {
      collectionId: filters.collectionId,
    };
  }  const variants = await prisma.variant.findMany({
    where: whereClause,
    include: {
      model: {
        include: {
          subSeries: true,
          collection: true,
          images: { take: 1 },
        },
      },
      images: { take: 1 },
    },
    orderBy: [
      { year: 'desc' },
      { model: { collection: { name: 'asc' } } },
      { toyNumber: 'asc' },
    ],
  });  return variants.map((v) => {
    // Get first image from variant, or fallback to model image
    const image = v.images[0] || v.model.images[0];
    // Image path handling: paths are stored relative to public folder
    // If path doesn't start with /, add it. If it starts with /images, use as is.
    // Otherwise, assume it's relative and make it absolute
    let imagePath: string | null = null;
    if (image) {
      const imgPath = image.path;
      if (imgPath.startsWith('/images/')) {
        imagePath = imgPath;
      } else if (imgPath.startsWith('/')) {
        imagePath = imgPath;
      } else if (imgPath.startsWith('images/')) {
        imagePath = `/${imgPath}`;
      } else {
        imagePath = `/images/hotwheels/${imgPath}`;
      }
    }    return {
      id: v.id,
      toyNumber: v.toyNumber || null,
      colNumber: v.cardNumber || null,
      modelName: v.model.castingName,
      series: v.model.subSeries?.name || null,
      seriesNumber: v.model.seriesNumber || null,
      photoThumbnail: imagePath,
    };
  });
}