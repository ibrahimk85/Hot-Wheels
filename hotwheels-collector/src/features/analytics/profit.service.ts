import prisma from '@/db';
import {
  getPackedMarketPrice,
  getLooseMarketPrice,
  getPackedPurchasePrice,
  getLoosePurchasePrice,
} from './price-helper';

export interface ProfitLossSummary {
  totalInvestment: number; // Toplam yatırım (alış fiyatları toplamı)
  totalCurrentValue: number; // Mevcut değer (piyasa fiyatları toplamı)
  totalProfit: number; // Net kâr
  totalROI: number; // Genel ROI yüzdesi
  packedInvestment: number;
  packedCurrentValue: number;
  packedProfit: number;
  packedROI: number;
  looseInvestment: number;
  looseCurrentValue: number;
  looseProfit: number;
  looseROI: number;
}

export interface ProfitLossItem {
  id: number;
  name: string;
  type: 'model' | 'variant';
  purchasePrice: number;
  marketPrice: number;
  quantity: number;
  totalPurchaseValue: number;
  totalMarketValue: number;
  profit: number;
  roi: number;
  collectionName: string;
  year?: number;
  color?: string;
}

/**
 * Get overall profit/loss summary
 */
export async function getProfitLossSummary(
  year?: number
): Promise<ProfitLossSummary> {
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
  });

  let totalInvestment = 0;
  let totalCurrentValue = 0;
  let packedInvestment = 0;
  let packedCurrentValue = 0;
  let looseInvestment = 0;
  let looseCurrentValue = 0;

  for (const variant of variants) {
    const model = variant.model;
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    // Packed calculations
    if (variant.packedOwned) {
      const packedPurchase = getPackedPurchasePrice(model);
      const packedMarket = getPackedMarketPrice(model);
      
      if (packedPurchase > 0) {
        packedInvestment += packedPurchase * qty;
      }
      if (packedMarket > 0) {
        packedCurrentValue += packedMarket * qty;
      }
    }

    // Loose calculations
    if (variant.looseOwned) {
      const loosePurchase = getLoosePurchasePrice(model);
      const looseMarket = getLooseMarketPrice(model);
      
      if (loosePurchase > 0) {
        looseInvestment += loosePurchase * qty;
      }
      if (looseMarket > 0) {
        looseCurrentValue += looseMarket * qty;
      }
    }
  }

  totalInvestment = packedInvestment + looseInvestment;
  totalCurrentValue = packedCurrentValue + looseCurrentValue;
  const totalProfit = totalCurrentValue - totalInvestment;
  const totalROI = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

  const packedProfit = packedCurrentValue - packedInvestment;
  const packedROI = packedInvestment > 0 ? (packedProfit / packedInvestment) * 100 : 0;

  const looseProfit = looseCurrentValue - looseInvestment;
  const looseROI = looseInvestment > 0 ? (looseProfit / looseInvestment) * 100 : 0;

  return {
    totalInvestment,
    totalCurrentValue,
    totalProfit,
    totalROI,
    packedInvestment,
    packedCurrentValue,
    packedProfit,
    packedROI,
    looseInvestment,
    looseCurrentValue,
    looseProfit,
    looseROI,
  };
}

/**
 * Get top profitable items (highest ROI)
 */
export async function getTopProfitableItems(
  limit: number = 10,
  year?: number
): Promise<ProfitLossItem[]> {
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
    take: limit * 3, // Get more to filter
  });

  const items: ProfitLossItem[] = [];

  for (const variant of variants) {
    const model = variant.model;
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    // Calculate for packed
    if (variant.packedOwned) {
      const purchasePrice = getPackedPurchasePrice(model);
      const marketPrice = getPackedMarketPrice(model);
      
      if (purchasePrice > 0 && marketPrice > 0) {
        const totalPurchase = purchasePrice * qty;
        const totalMarket = marketPrice * qty;
        const profit = totalMarket - totalPurchase;
        const roi = purchasePrice > 0 ? (profit / totalPurchase) * 100 : 0;

        items.push({
          id: variant.id,
          name: model.castingName,
          type: 'variant',
          purchasePrice,
          marketPrice,
          quantity: qty,
          totalPurchaseValue: totalPurchase,
          totalMarketValue: totalMarket,
          profit,
          roi,
          collectionName: model.collection.name,
          year: variant.year,
          color: variant.color || undefined,
        });
      }
    }

    // Calculate for loose
    if (variant.looseOwned) {
      const purchasePrice = getLoosePurchasePrice(model);
      const marketPrice = getLooseMarketPrice(model);
      
      if (purchasePrice > 0 && marketPrice > 0) {
        const totalPurchase = purchasePrice * qty;
        const totalMarket = marketPrice * qty;
        const profit = totalMarket - totalPurchase;
        const roi = purchasePrice > 0 ? (profit / totalPurchase) * 100 : 0;

        items.push({
          id: variant.id,
          name: model.castingName,
          type: 'variant',
          purchasePrice,
          marketPrice,
          quantity: qty,
          totalPurchaseValue: totalPurchase,
          totalMarketValue: totalMarket,
          profit,
          roi,
          collectionName: model.collection.name,
          year: variant.year,
          color: variant.color || undefined,
        });
      }
    }
  }

  // Sort by ROI descending, then by profit
  return items
    .sort((a, b) => {
      if (Math.abs(b.roi - a.roi) > 0.01) {
        return b.roi - a.roi;
      }
      return b.profit - a.profit;
    })
    .slice(0, limit);
}

/**
 * Get items that lost value (market price < purchase price)
 */
export async function getValueLossItems(
  limit: number = 10,
  year?: number
): Promise<ProfitLossItem[]> {
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
    take: limit * 3,
  });

  const items: ProfitLossItem[] = [];

  for (const variant of variants) {
    const model = variant.model;
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    // Check packed
    if (variant.packedOwned) {
      const purchasePrice = getPackedPurchasePrice(model);
      const marketPrice = getPackedMarketPrice(model);
      
      if (purchasePrice > 0 && marketPrice > 0 && marketPrice < purchasePrice) {
        const totalPurchase = purchasePrice * qty;
        const totalMarket = marketPrice * qty;
        const profit = totalMarket - totalPurchase;
        const roi = (profit / totalPurchase) * 100;

        items.push({
          id: variant.id,
          name: model.castingName,
          type: 'variant',
          purchasePrice,
          marketPrice,
          quantity: qty,
          totalPurchaseValue: totalPurchase,
          totalMarketValue: totalMarket,
          profit,
          roi,
          collectionName: model.collection.name,
          year: variant.year,
          color: variant.color || undefined,
        });
      }
    }

    // Check loose
    if (variant.looseOwned) {
      const purchasePrice = getLoosePurchasePrice(model);
      const marketPrice = getLooseMarketPrice(model);
      
      if (purchasePrice > 0 && marketPrice > 0 && marketPrice < purchasePrice) {
        const totalPurchase = purchasePrice * qty;
        const totalMarket = marketPrice * qty;
        const profit = totalMarket - totalPurchase;
        const roi = (profit / totalPurchase) * 100;

        items.push({
          id: variant.id,
          name: model.castingName,
          type: 'variant',
          purchasePrice,
          marketPrice,
          quantity: qty,
          totalPurchaseValue: totalPurchase,
          totalMarketValue: totalMarket,
          profit,
          roi,
          collectionName: model.collection.name,
          year: variant.year,
          color: variant.color || undefined,
        });
      }
    }
  }

  // Sort by worst ROI (most negative)
  return items
    .sort((a, b) => a.roi - b.roi)
    .slice(0, limit);
}

/**
 * Get collection-wise profitability
 */
export interface CollectionProfitability {
  collectionName: string;
  totalInvestment: number;
  totalCurrentValue: number;
  totalProfit: number;
  roi: number;
  itemCount: number;
}

export async function getCollectionProfitability(
  year?: number
): Promise<CollectionProfitability[]> {
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
          collection: true,
        },
      },
    },
  });

  const collectionMap = new Map<string, CollectionProfitability>();

  for (const collection of collections) {
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    let itemCount = 0;

    for (const model of collection.models) {
      for (const variant of model.variants) {
        const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

        // Packed
        if (variant.packedOwned) {
          const purchasePrice = getPackedPurchasePrice(model);
          const marketPrice = getPackedMarketPrice(model);
          
          if (purchasePrice > 0) {
            totalInvestment += purchasePrice * qty;
            itemCount += qty;
          }
          if (marketPrice > 0) {
            totalCurrentValue += marketPrice * qty;
          }
        }

        // Loose
        if (variant.looseOwned) {
          const purchasePrice = getLoosePurchasePrice(model);
          const marketPrice = getLooseMarketPrice(model);
          
          if (purchasePrice > 0) {
            totalInvestment += purchasePrice * qty;
            itemCount += qty;
          }
          if (marketPrice > 0) {
            totalCurrentValue += marketPrice * qty;
          }
        }
      }
    }

    if (itemCount > 0) {
      const totalProfit = totalCurrentValue - totalInvestment;
      const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

      collectionMap.set(collection.name, {
        collectionName: collection.name,
        totalInvestment,
        totalCurrentValue,
        totalProfit,
        roi,
        itemCount,
      });
    }
  }

  return Array.from(collectionMap.values())
    .sort((a, b) => b.roi - a.roi);
}







