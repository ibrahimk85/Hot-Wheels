import prisma from '@/db';
import {
  getPackedMarketPrice,
  getLooseMarketPrice,
} from './price-helper';

export interface PriceTrendData {
  period: string; // "2024-01", "2024-02", etc. or "2024", "2025"
  averageMarketPrice: number;
  averagePurchasePrice: number;
  priceChange: number;
  priceChangePercentage: number;
  itemCount: number;
}

export interface FastestAppreciatingItem {
  id: number;
  name: string;
  type: 'model' | 'variant';
  purchasePrice: number;
  currentMarketPrice: number;
  priceIncrease: number;
  priceIncreasePercentage: number;
  collectionName: string;
  year?: number;
  color?: string;
}

/**
 * Get price trend by year
 */
export async function getPriceTrendByYear(): Promise<PriceTrendData[]> {
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

  const trends: PriceTrendData[] = [];

  for (const yearData of years) {
    let totalMarketPrice = 0;
    let totalPurchasePrice = 0;
    let priceCount = 0;

    for (const collection of yearData.collections) {
      for (const model of collection.models) {
        for (const variant of model.variants) {
          const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

          if (variant.packedOwned || variant.looseOwned) {
            const marketPrice = variant.packedOwned
              ? getPackedMarketPrice(model)
              : getLooseMarketPrice(model);
            
            // For purchase price, we'll use a simple average approach
            // In a real scenario, you'd track historical purchase prices
            const purchasePrice = variant.packedOwned
              ? model.packedPurchasePrice ?? model.packedPrice ?? 0
              : model.loosePurchasePrice ?? model.loosePrice ?? 0;

            if (marketPrice > 0) {
              totalMarketPrice += marketPrice;
              priceCount++;
            }
            if (purchasePrice > 0) {
              totalPurchasePrice += purchasePrice;
            }
          }
        }
      }
    }

    if (priceCount > 0) {
      const averageMarketPrice = totalMarketPrice / priceCount;
      const averagePurchasePrice = totalPurchasePrice / priceCount;
      const priceChange = averageMarketPrice - averagePurchasePrice;
      const priceChangePercentage = averagePurchasePrice > 0
        ? (priceChange / averagePurchasePrice) * 100
        : 0;

      trends.push({
        period: `${yearData.year}`,
        averageMarketPrice,
        averagePurchasePrice,
        priceChange,
        priceChangePercentage,
        itemCount: priceCount,
      });
    }
  }

  return trends;
}

/**
 * Get fastest appreciating items (highest price increase percentage)
 */
export async function getFastestAppreciatingItems(
  limit: number = 10,
  year?: number
): Promise<FastestAppreciatingItem[]> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  const variants = await prisma.variant.findMany({
    where: {
      ...variantWhere,
      OR: [
        { packedOwned: true },
        { looseOwned: true },
      ],
    },
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
    take: limit * 3,
  });

  const items: FastestAppreciatingItem[] = [];

  for (const variant of variants) {
    const model = variant.model;
    
    let purchasePrice = 0;
    let marketPrice = 0;

    if (variant.packedOwned) {
      purchasePrice = model.packedPurchasePrice ?? model.packedPrice ?? 0;
      marketPrice = getPackedMarketPrice(model);
    } else if (variant.looseOwned) {
      purchasePrice = model.loosePurchasePrice ?? model.loosePrice ?? 0;
      marketPrice = getLooseMarketPrice(model);
    }

    if (purchasePrice > 0 && marketPrice > 0 && marketPrice > purchasePrice) {
      const priceIncrease = marketPrice - purchasePrice;
      const priceIncreasePercentage = (priceIncrease / purchasePrice) * 100;

      items.push({
        id: variant.id,
        name: model.castingName,
        type: 'variant',
        purchasePrice,
        currentMarketPrice: marketPrice,
        priceIncrease,
        priceIncreasePercentage,
        collectionName: model.collection.name,
        year: variant.year,
        color: variant.color || undefined,
      });
    }
  }

  return items
    .sort((a, b) => b.priceIncreasePercentage - a.priceIncreasePercentage)
    .slice(0, limit);
}

/**
 * Get price alerts summary
 */
export interface PriceAlertsSummary {
  totalActiveAlerts: number;
  triggeredAlerts: number;
  nearTargetAlerts: number; // Within 10% of target
  alertsByCondition: {
    below: number;
    above: number;
    equal: number;
  };
}

export async function getPriceAlertsSummary(): Promise<PriceAlertsSummary> {
  const [allAlerts, triggeredAlerts] = await Promise.all([
    prisma.priceAlert.findMany({
      where: {
        active: true,
      },
      include: {
        model: true,
        variant: true,
      },
    }),
    prisma.priceAlert.findMany({
      where: {
        active: true,
        notified: true,
      },
    }),
  ]);

  let nearTargetCount = 0;
  const alertsByCondition = {
    below: 0,
    above: 0,
    equal: 0,
  };

  for (const alert of allAlerts) {
    // Count by condition
    if (alert.condition === 'below') alertsByCondition.below++;
    else if (alert.condition === 'above') alertsByCondition.above++;
    else if (alert.condition === 'equal') alertsByCondition.equal++;

    // Check if near target (within 10%)
    const model = alert.model;
    if (model) {
      const currentPrice = alert.variantId
        ? (alert.variant?.packedOwned
            ? getPackedMarketPrice(model)
            : getLooseMarketPrice(model))
        : getPackedMarketPrice(model);
      
      if (currentPrice > 0 && alert.targetPrice > 0) {
        const difference = Math.abs(currentPrice - alert.targetPrice);
        const percentage = (difference / alert.targetPrice) * 100;
        
        if (percentage <= 10 && !alert.notified) {
          nearTargetCount++;
        }
      }
    }
  }

  return {
    totalActiveAlerts: allAlerts.length,
    triggeredAlerts: triggeredAlerts.length,
    nearTargetAlerts: nearTargetCount,
    alertsByCondition,
  };
}







