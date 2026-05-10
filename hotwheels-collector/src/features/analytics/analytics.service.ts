import prisma from '@/db';

export interface CollectionDistribution {
  name: string;
  count: number;
  percentage: number;
}

export interface YearDistribution {
  year: number;
  count: number;
  packedOwnedCount: number;
  looseOwnedCount: number;
  bothOwnedCount: number;
}

export interface TimelineData {
  month: string;
  count: number;
  packedOwnedCount: number;
  looseOwnedCount: number;
  bothOwnedCount: number;
}

export interface TopSeries {
  name: string;
  count: number;
  packedOwnedCount: number;
  looseOwnedCount: number;
  bothOwnedCount: number;
  year?: number; // Yıl bilgisi (sadece "Tümü" seçiliyken gösterilir)
}

export interface THSTHRatio {
  totalTH: number;
  totalSTH: number;
  totalVariants: number;
  thPercentage: number;
  sthPercentage: number;
}

export interface CompletionStats {
  totalVariants: number;
  packedOwnedVariants: number;
  looseOwnedVariants: number;
  bothOwnedVariants: number;
  packedCompletionPercentage: number;
  looseCompletionPercentage: number;
  bothCompletionPercentage: number;
  totalModels: number;
  wishlistedModels: number;
}

/**
 * Get collection distribution data for pie chart
 */
export async function getCollectionDistribution(
  year?: number
): Promise<CollectionDistribution[]> {
  const whereClause = year
    ? {
        year: {
          year: year,
        },
      }
    : {};

  const collections = await prisma.collection.findMany({
    where: whereClause,
    include: {
      models: {
        include: {
          variants: {
            where: year
              ? {
                  year: year,
                }
              : {},
          },
        },
      },
    },
  });

  const collectionCounts = collections.map((collection) => {
    const variantCount = (collection.models || []).reduce(
      (sum, model) => sum + (model.variants?.length || 0),
      0
    );
    return {
      name: collection.name,
      count: variantCount,
    };
  });

  const total = collectionCounts.reduce((sum, c) => sum + c.count, 0);

  const withPercentages = collectionCounts
    .map((item) => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  // Küçük değerleri (< 2%) "Diğer" kategorisine topla
  const threshold = 2; // 2% altındakiler "Diğer" olacak
  const mainItems = withPercentages.filter((item) => item.percentage >= threshold);
  const otherItems = withPercentages.filter((item) => item.percentage < threshold);
  
  const result = [...mainItems];
  
  if (otherItems.length > 0) {
    const otherCount = otherItems.reduce((sum, item) => sum + item.count, 0);
    const otherPercentage = total > 0 ? (otherCount / total) * 100 : 0;
    result.push({
      name: 'Diğer',
      count: otherCount,
      percentage: otherPercentage,
    });
  }

  return result;
}

/**
 * Get year distribution data for bar chart
 */
export async function getYearDistribution(): Promise<YearDistribution[]> {
  const variants = await prisma.variant.groupBy({
    by: ['year'],
    _count: {
      id: true,
    },
  });

  const [packedOwnedVariants, looseOwnedVariants, bothOwnedVariants] = await Promise.all([
    prisma.variant.groupBy({
      by: ['year'],
      where: {
        packedOwned: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.variant.groupBy({
      by: ['year'],
      where: {
        looseOwned: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.variant.groupBy({
      by: ['year'],
      where: {
        packedOwned: true,
        looseOwned: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const packedOwnedMap = new Map(
    packedOwnedVariants.map((v) => [v.year, v._count.id])
  );
  const looseOwnedMap = new Map(
    looseOwnedVariants.map((v) => [v.year, v._count.id])
  );
  const bothOwnedMap = new Map(
    bothOwnedVariants.map((v) => [v.year, v._count.id])
  );

  return variants
    .map((variant) => ({
      year: variant.year,
      count: variant._count.id,
      packedOwnedCount: packedOwnedMap.get(variant.year) || 0,
      looseOwnedCount: looseOwnedMap.get(variant.year) || 0,
      bothOwnedCount: bothOwnedMap.get(variant.year) || 0,
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Get timeline data (monthly growth) - simplified version
 * Since we don't have createdAt field, we'll use year as proxy
 */
export async function getTimelineData(): Promise<TimelineData[]> {
  // Group by year for now (can be enhanced with actual dates later)
  const yearData = await getYearDistribution();

  return yearData.map((data) => ({
    month: `${data.year}`,
    count: data.count,
    packedOwnedCount: data.packedOwnedCount,
    looseOwnedCount: data.looseOwnedCount,
    bothOwnedCount: data.bothOwnedCount,
  }));
}

/**
 * Get top 10 series by owned count
 */
export async function getTopSeries(
  limit: number = 10,
  year?: number
): Promise<TopSeries[]> {
  const whereClause = year
    ? {
        year: {
          year: year,
        },
      }
    : {};

  const collections = await prisma.collection.findMany({
    where: whereClause,
    include: {
      year: true,
      models: {
        include: {
          variants: {
            where: year
              ? {
                  year: year,
                }
              : {},
          },
        },
      },
    },
  });

  const seriesData = collections
    .map((collection) => {
      const totalCount = collection.models.reduce(
        (sum, model) => sum + model.variants.length,
        0
      );
      
      const packedOwnedCount = collection.models.reduce(
        (sum, model) => sum + model.variants.filter((v) => v.packedOwned).length,
        0
      );
      const looseOwnedCount = collection.models.reduce(
        (sum, model) => sum + model.variants.filter((v) => v.looseOwned).length,
        0
      );
      const bothOwnedCount = collection.models.reduce(
        (sum, model) => sum + model.variants.filter((v) => v.packedOwned && v.looseOwned).length,
        0
      );

      return {
        name: collection.name,
        count: totalCount,
        packedOwnedCount: packedOwnedCount,
        looseOwnedCount: looseOwnedCount,
        bothOwnedCount: bothOwnedCount,
        year: collection.year.year,
      };
    })
    .filter((item) => item.count > 0);

  // Packed completion percentage'e göre sırala (en yüksek yüzdeden en düşüğe)
  return seriesData
    .map((item) => {
      const packedPercentage = item.count > 0 ? (item.packedOwnedCount / item.count) * 100 : 0;
      return { ...item, packedPercentage };
    })
    .sort((a, b) => b.packedPercentage - a.packedPercentage)
    .slice(0, limit);
}

/**
 * Get TH/STH ratio statistics
 */
export async function getTHSTHRatio(year?: number): Promise<THSTHRatio> {
  const whereClause = year
    ? {
        year: year,
      }
    : {};

  const [totalTH, totalSTH, totalVariants] = await Promise.all([
    prisma.variant.count({
      where: {
        ...whereClause,
        isTreasureHunt: true,
      },
    }),
    prisma.variant.count({
      where: {
        ...whereClause,
        isSuperTreasureHunt: true,
      },
    }),
    prisma.variant.count({
      where: whereClause,
    }),
  ]);

  return {
    totalTH,
    totalSTH,
    totalVariants,
    thPercentage: totalVariants > 0 ? (totalTH / totalVariants) * 100 : 0,
    sthPercentage: totalVariants > 0 ? (totalSTH / totalVariants) * 100 : 0,
  };
}

/**
 * Get completion statistics
 */
export async function getCompletionStats(
  year?: number
): Promise<CompletionStats> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  const modelWhere = year
    ? {
        variants: {
          some: {
            year: year,
          },
        },
      }
    : {};

  const [totalVariants, packedOwnedVariants, looseOwnedVariants, bothOwnedVariants, totalModels, wishlistedModels] =
    await Promise.all([
      prisma.variant.count({
        where: variantWhere,
      }),
      prisma.variant.count({
        where: {
          ...variantWhere,
          packedOwned: true,
        },
      }),
      prisma.variant.count({
        where: {
          ...variantWhere,
          looseOwned: true,
        },
      }),
      prisma.variant.count({
        where: {
          ...variantWhere,
          packedOwned: true,
          looseOwned: true,
        },
      }),
      prisma.model.count({
        where: modelWhere,
      }),
      prisma.model.count({
        where: {
          ...modelWhere,
          wishlisted: true,
        },
      }),
    ]);

  return {
    totalVariants,
    packedOwnedVariants,
    looseOwnedVariants,
    bothOwnedVariants,
    packedCompletionPercentage:
      totalVariants > 0 ? (packedOwnedVariants / totalVariants) * 100 : 0,
    looseCompletionPercentage:
      totalVariants > 0 ? (looseOwnedVariants / totalVariants) * 100 : 0,
    bothCompletionPercentage:
      totalVariants > 0 ? (bothOwnedVariants / totalVariants) * 100 : 0,
    totalModels,
    wishlistedModels,
  };
}

