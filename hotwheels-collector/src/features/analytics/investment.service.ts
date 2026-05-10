import prisma from '@/db';
import {
  getPackedMarketPrice,
  getLooseMarketPrice,
  getPackedPurchasePrice,
  getLoosePurchasePrice,
} from './price-helper';

export interface InvestmentSummary {
  totalInvestment: number;
  totalCurrentValue: number;
  netProfit: number;
  overallROI: number;
  averagePurchasePrice: number;
  averageMarketPrice: number;
  itemCount: number;
}

export interface BuyRecommendation {
  id: number;
  name: string;
  type: 'model' | 'variant';
  currentMarketPrice: number;
  averagePurchasePrice: number;
  discountPercentage: number;
  collectionName: string;
  year?: number;
  reason: string;
}

export interface SellRecommendation {
  id: number;
  name: string;
  type: 'model' | 'variant';
  purchasePrice: number;
  currentMarketPrice: number;
  profit: number;
  roi: number;
  collectionName: string;
  year?: number;
  reason: string;
}

/**
 * Get overall investment summary
 */
export async function getInvestmentSummary(
  year?: number
): Promise<InvestmentSummary> {
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
  let totalPurchasePriceSum = 0;
  let totalMarketPriceSum = 0;
  let itemCount = 0;

  for (const variant of variants) {
    const model = variant.model;
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    // Packed
    if (variant.packedOwned) {
      const purchasePrice = getPackedPurchasePrice(model);
      const marketPrice = getPackedMarketPrice(model);
      
      if (purchasePrice > 0) {
        totalInvestment += purchasePrice * qty;
        totalPurchasePriceSum += purchasePrice;
        itemCount += qty;
      }
      if (marketPrice > 0) {
        totalCurrentValue += marketPrice * qty;
        totalMarketPriceSum += marketPrice;
      }
    }

    // Loose
    if (variant.looseOwned) {
      const purchasePrice = getLoosePurchasePrice(model);
      const marketPrice = getLooseMarketPrice(model);
      
      if (purchasePrice > 0) {
        totalInvestment += purchasePrice * qty;
        totalPurchasePriceSum += purchasePrice;
        itemCount += qty;
      }
      if (marketPrice > 0) {
        totalCurrentValue += marketPrice * qty;
        totalMarketPriceSum += marketPrice;
      }
    }
  }

  const netProfit = totalCurrentValue - totalInvestment;
  const overallROI = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
  
  // Calculate averages (only for items with prices)
  const priceCount = variants.filter(v => {
    const model = v.model;
    if (v.packedOwned) {
      return getPackedPurchasePrice(model) > 0 || getPackedMarketPrice(model) > 0;
    }
    if (v.looseOwned) {
      return getLoosePurchasePrice(model) > 0 || getLooseMarketPrice(model) > 0;
    }
    return false;
  }).length;

  const averagePurchasePrice = priceCount > 0 ? totalPurchasePriceSum / priceCount : 0;
  const averageMarketPrice = priceCount > 0 ? totalMarketPriceSum / priceCount : 0;

  return {
    totalInvestment,
    totalCurrentValue,
    netProfit,
    overallROI,
    averagePurchasePrice,
    averageMarketPrice,
    itemCount,
  };
}

/**
 * Get buy recommendations (items where market price < average purchase price)
 */
export async function getBuyRecommendations(
  limit: number = 10,
  year?: number
): Promise<BuyRecommendation[]> {
  const variantWhere = year
    ? {
        year: year,
      }
    : {};

  // First, calculate average purchase prices per model
  const models = await prisma.model.findMany({
    where: year
      ? {
          variants: {
            some: {
              year: year,
            },
          },
        }
      : {},
    include: {
      variants: {
        where: variantWhere,
      },
      collection: true,
    },
  });

  const recommendations: BuyRecommendation[] = [];

  for (const model of models) {
    // Calculate average purchase price for this model
    const packedPurchase = getPackedPurchasePrice(model);
    const loosePurchase = getLoosePurchasePrice(model);
    const avgPurchasePrice = packedPurchase > 0 && loosePurchase > 0
      ? (packedPurchase + loosePurchase) / 2
      : packedPurchase > 0
      ? packedPurchase
      : loosePurchase;

    const packedMarket = getPackedMarketPrice(model);
    const looseMarket = getLooseMarketPrice(model);
    const currentMarketPrice = packedMarket > 0 && looseMarket > 0
      ? (packedMarket + looseMarket) / 2
      : packedMarket > 0
      ? packedMarket
      : looseMarket;

    // Check if market price is lower than purchase price (good deal)
    if (avgPurchasePrice > 0 && currentMarketPrice > 0 && currentMarketPrice < avgPurchasePrice) {
      const discountPercentage = ((avgPurchasePrice - currentMarketPrice) / avgPurchasePrice) * 100;

      // Check if not already owned
      const hasOwnedVariant = model.variants.some(v => v.packedOwned || v.looseOwned);
      
      if (!hasOwnedVariant || discountPercentage > 10) {
        recommendations.push({
          id: model.id,
          name: model.castingName,
          type: 'model',
          currentMarketPrice,
          averagePurchasePrice: avgPurchasePrice,
          discountPercentage,
          collectionName: model.collection.name,
          year: model.variants[0]?.year,
          reason: discountPercentage > 20 
            ? 'Yüksek indirim fırsatı' 
            : 'Piyasa fiyatı ortalamanın altında',
        });
      }
    }
  }

  return recommendations
    .sort((a, b) => b.discountPercentage - a.discountPercentage)
    .slice(0, limit);
}

/**
 * Get sell recommendations (items with high profit potential)
 */
export async function getSellRecommendations(
  limit: number = 10,
  year?: number
): Promise<SellRecommendation[]> {
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

  const recommendations: SellRecommendation[] = [];

  for (const variant of variants) {
    const model = variant.model;
    const qty = variant.quantity > 0 ? variant.quantity : model.quantity || 1;

    let purchasePrice = 0;
    let marketPrice = 0;

    if (variant.packedOwned) {
      purchasePrice = getPackedPurchasePrice(model);
      marketPrice = getPackedMarketPrice(model);
    } else if (variant.looseOwned) {
      purchasePrice = getLoosePurchasePrice(model);
      marketPrice = getLooseMarketPrice(model);
    }

    if (purchasePrice > 0 && marketPrice > 0 && marketPrice > purchasePrice) {
      const profit = (marketPrice - purchasePrice) * qty;
      const roi = (profit / (purchasePrice * qty)) * 100;

      // Only recommend if ROI is significant (>20%)
      if (roi > 20) {
        recommendations.push({
          id: variant.id,
          name: model.castingName,
          type: 'variant',
          purchasePrice,
          currentMarketPrice: marketPrice,
          profit,
          roi,
          collectionName: model.collection.name,
          year: variant.year,
          reason: roi > 50
            ? 'Çok yüksek kâr potansiyeli'
            : roi > 30
            ? 'Yüksek kâr potansiyeli'
            : 'İyi kâr potansiyeli',
        });
      }
    }
  }

  return recommendations
    .sort((a, b) => b.roi - a.roi)
    .slice(0, limit);
}







