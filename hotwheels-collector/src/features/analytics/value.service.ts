import prisma from '@/db';
import { getPackedMarketPrice, getLooseMarketPrice, getPackedPurchasePrice, getLoosePurchasePrice } from './price-helper';

export interface CollectionValue {
  name: string;
  packedValue: number;
  looseValue: number;
  totalValue: number;
  variantCount: number;
}

export interface TopValuableModel {
  id: number;
  castingName: string;
  packedPrice: number | null;
  loosePrice: number | null;
  totalValue: number;
  quantity: number;
  collectionName: string;
}

export interface TopValuableVariant {
  id: number;
  modelName: string;
  color: string | null;
  year: number;
  packedPrice: number | null;
  loosePrice: number | null;
  totalValue: number;
  quantity: number;
  collectionName: string;
}

export interface ValueTrend {
  year: number;
  totalValue: number;
  packedValue: number;
  looseValue: number;
}

/**
 * Calculate total collection value
 */
export async function getTotalCollectionValue(
  year?: number
): Promise<{
  totalPackedValue: number;
  totalLooseValue: number;
  totalValue: number;
}> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  // Get all variants with their models
  const variants = await prisma.variant.findMany({
    where: variantWhere,
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
  });

  let totalPackedValue = 0;
  let totalLooseValue = 0;

  for (const variant of variants) {
    const model = variant.model;
    const quantity = variant.quantity || 1;

    // Use variant quantity, fallback to model quantity
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    // Calculate packed value only if variant is packedOwned
    if (variant.packedOwned) {
      const packedPrice = getPackedMarketPrice(model);
      if (packedPrice > 0) {
        totalPackedValue += packedPrice * qty;
      }
    }

    // Calculate loose value only if variant is looseOwned
    if (variant.looseOwned) {
      const loosePrice = getLooseMarketPrice(model);
      if (loosePrice > 0) {
        totalLooseValue += loosePrice * qty;
      }
    }
  }

  return {
    totalPackedValue,
    totalLooseValue,
    totalValue: totalPackedValue + totalLooseValue,
  };
}

/**
 * Get collection-wise value distribution
 */
export async function getCollectionValueDistribution(
  year?: number
): Promise<CollectionValue[]> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  const collections = await prisma.collection.findMany({
    where: year
      ? {
          year: {
            year: year,
          },
        }
      : {},
    include: {
      models: {
        include: {
          variants: {
            where: variantWhere,
          },
        },
      },
    },
  });

  const collectionValues: CollectionValue[] = [];

  for (const collection of collections) {
    let packedValue = 0;
    let looseValue = 0;
    let variantCount = 0;

    for (const model of collection.models) {
      const qty = model.quantity || 1;

      // Only count variants that are owned
      const packedOwnedVariants = model.variants.filter((v) => v.packedOwned);
      const looseOwnedVariants = model.variants.filter((v) => v.looseOwned);

      const packedPrice = getPackedMarketPrice(model);
      if (packedPrice > 0 && packedOwnedVariants.length > 0) {
        packedValue += packedPrice * qty * packedOwnedVariants.length;
      }
      const loosePrice = getLooseMarketPrice(model);
      if (loosePrice > 0 && looseOwnedVariants.length > 0) {
        looseValue += loosePrice * qty * looseOwnedVariants.length;
      }

      variantCount += model.variants.length;
    }

    if (variantCount > 0) {
      collectionValues.push({
        name: collection.name,
        packedValue,
        looseValue,
        totalValue: packedValue + looseValue,
        variantCount,
      });
    }
  }

  return collectionValues.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Get top 10 most valuable models
 */
export async function getTopValuableModels(
  limit: number = 10,
  year?: number
): Promise<TopValuableModel[]> {
  const modelWhere = year
    ? {
        variants: {
          some: {
            year: year,
          },
        },
      }
    : {};

  const models = await prisma.model.findMany({
    where: {
      ...modelWhere,
      OR: [
        { packedPrice: { not: null } },
        { loosePrice: { not: null } },
        { packedMarketPrice: { not: null } },
        { looseMarketPrice: { not: null } },
        { packedPurchasePrice: { not: null } },
        { loosePurchasePrice: { not: null } },
      ],
    },
    include: {
      collection: true,
      variants: {
        where: year
          ? {
              year: year,
            }
          : {},
      },
    },
    take: limit * 2, // Get more to filter and sort
  });

  const valuableModels: TopValuableModel[] = models
    .map((model) => {
      const qty = model.quantity || 1;
      
      // Only count variants that are owned
      const packedOwnedVariants = model.variants.filter((v) => v.packedOwned);
      const looseOwnedVariants = model.variants.filter((v) => v.looseOwned);
      
      const packedValue = packedOwnedVariants.length > 0 
        ? getPackedMarketPrice(model) * qty * packedOwnedVariants.length 
        : 0;
      const looseValue = looseOwnedVariants.length > 0
        ? getLooseMarketPrice(model) * qty * looseOwnedVariants.length
        : 0;
      const totalValue = packedValue + looseValue;

      return {
        id: model.id,
        castingName: model.castingName,
        packedPrice: packedOwnedVariants.length > 0 ? getPackedMarketPrice(model) || null : null,
        loosePrice: looseOwnedVariants.length > 0 ? getLooseMarketPrice(model) || null : null,
        totalValue,
        quantity: qty,
        collectionName: model.collection.name,
      };
    })
    .filter((model) => model.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);

  return valuableModels;
}

/**
 * Get top 10 most valuable variants
 */
export async function getTopValuableVariants(
  limit: number = 10,
  year?: number
): Promise<TopValuableVariant[]> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  const variants = await prisma.variant.findMany({
    where: variantWhere,
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
    take: limit * 2, // Get more to filter and sort
  });

  const valuableVariants: TopValuableVariant[] = variants
    .map((variant) => {
      const model = variant.model;
      const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;
      
      // Only calculate value if variant is owned
      const packedValue = variant.packedOwned 
        ? getPackedMarketPrice(model) * qty 
        : 0;
      const looseValue = variant.looseOwned
        ? getLooseMarketPrice(model) * qty
        : 0;
      const totalValue = packedValue + looseValue;

      return {
        id: variant.id,
        modelName: model.castingName,
        color: variant.color || variant.releaseName,
        year: variant.year,
        packedPrice: variant.packedOwned ? getPackedMarketPrice(model) || null : null,
        loosePrice: variant.looseOwned ? getLooseMarketPrice(model) || null : null,
        totalValue,
        quantity: qty,
        collectionName: model.collection.name,
      };
    })
    .filter((variant) => variant.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);

  return valuableVariants;
}

/**
 * Get value trend by year
 */
export async function getValueTrend(): Promise<ValueTrend[]> {
  const years = await prisma.year.findMany({
    orderBy: { year: 'asc' },
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

  const trends: ValueTrend[] = [];

  for (const yearData of years) {
    let packedValue = 0;
    let looseValue = 0;

    for (const collection of yearData.collections) {
      for (const model of collection.models) {
        const qty = model.quantity || 1;
        
        // Only count variants that are owned
        const packedOwnedVariants = model.variants.filter((v) => v.packedOwned);
        const looseOwnedVariants = model.variants.filter((v) => v.looseOwned);

        const packedPrice = getPackedMarketPrice(model);
        if (packedPrice > 0 && packedOwnedVariants.length > 0) {
          packedValue += packedPrice * qty * packedOwnedVariants.length;
        }
        const loosePrice = getLooseMarketPrice(model);
        if (loosePrice > 0 && looseOwnedVariants.length > 0) {
          looseValue += loosePrice * qty * looseOwnedVariants.length;
        }
      }
    }

    if (packedValue > 0 || looseValue > 0) {
      trends.push({
        year: yearData.year,
        totalValue: packedValue + looseValue,
        packedValue,
        looseValue,
      });
    }
  }

  return trends;
}




