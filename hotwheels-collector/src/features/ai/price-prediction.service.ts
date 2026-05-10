import prisma from '@/db';

export interface PricePrediction {
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: '1month' | '3months' | '6months' | '1year';
  factors: string[];
}

/**
 * Basit fiyat tahmin modeli (regression)
 */
export async function predictPrice(
  modelId: number,
  timeframe: '1month' | '3months' | '6months' | '1year' = '3months'
): Promise<PricePrediction | null> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    include: {
      variants: {
        include: {
          images: {
            take: 1,
          },
        },
      },
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

  if (!model) {
    return null;
  }

  // Fiyat geçmişini al
  const priceHistory = await prisma.priceHistory.findMany({
    where: { modelId },
    orderBy: { recordedAt: 'desc' },
    take: 30,
  });

  if (priceHistory.length === 0) {
    return null;
  }

  // Mevcut fiyat
  const currentPrice = Math.max(model.packedPrice || 0, model.loosePrice || 0);
  if (currentPrice === 0) {
    const latestPrice = priceHistory[0]?.price || 0;
    if (latestPrice === 0) {
      return null;
    }
  }

  const basePrice = currentPrice || priceHistory[0]?.price || 0;

  // Basit trend analizi
  const prices = priceHistory.map((p) => p.price);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const recentAvg = prices.slice(0, 10).reduce((sum, p) => sum + p, 0) / Math.min(10, prices.length);
  const olderAvg = prices.slice(10).reduce((sum, p) => sum + p, 0) / Math.max(1, prices.length - 10);

  // Trend belirleme
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentAvg > olderAvg * 1.1) {
    trend = 'increasing';
  } else if (recentAvg < olderAvg * 0.9) {
    trend = 'decreasing';
  }

  // Faktörler
  const factors: string[] = [];
  
  // TH/STH kontrolü
  const hasTH = model.variants.some((v) => v.isTreasureHunt);
  const hasSTH = model.variants.some((v) => v.isSuperTreasureHunt);
  
  if (hasSTH) {
    factors.push('Super Treasure Hunt - Yüksek değer potansiyeli');
  } else if (hasTH) {
    factors.push('Treasure Hunt - Artış potansiyeli');
  }

  // Yaş faktörü
  const year = model.subSeries?.collection.year.year || new Date().getFullYear();
  const age = new Date().getFullYear() - year;
  
  if (age > 10) {
    factors.push('Eski model - Koleksiyon değeri artabilir');
  } else if (age < 2) {
    factors.push('Yeni model - Fiyat stabil kalabilir');
  }

  // Koleksiyon faktörü
  const collectionName = model.subSeries?.collection.name?.toLowerCase() || '';
  if (collectionName.includes('premium') || collectionName.includes('boulevard')) {
    factors.push('Premium seri - Daha yüksek değer');
  }

  // Basit tahmin (linear regression benzeri)
  let predictedPrice = basePrice;
  const months = timeframe === '1month' ? 1 : timeframe === '3months' ? 3 : timeframe === '6months' ? 6 : 12;
  
  if (trend === 'increasing') {
    const growthRate = (recentAvg - olderAvg) / olderAvg;
    predictedPrice = basePrice * (1 + growthRate * months);
  } else if (trend === 'decreasing') {
    const declineRate = (olderAvg - recentAvg) / olderAvg;
    predictedPrice = basePrice * (1 - declineRate * months * 0.5); // Düşüş daha yavaş
  } else {
    // Stable - küçük artış
    predictedPrice = basePrice * 1.02; // %2 yıllık artış
  }

  // Confidence hesaplama
  let confidence = 0.5;
  if (priceHistory.length > 20) {
    confidence = 0.7;
  }
  if (priceHistory.length > 50) {
    confidence = 0.85;
  }
  if (hasSTH || hasTH) {
    confidence += 0.1; // TH/STH için daha yüksek güven
  }

  return {
    currentPrice: basePrice,
    predictedPrice: Math.max(0, predictedPrice),
    confidence: Math.min(1, confidence),
    trend,
    timeframe,
    factors,
  };
}

/**
 * Toplu fiyat tahmini
 */
export async function batchPredictPrices(
  modelIds: number[],
  timeframe: '1month' | '3months' | '6months' | '1year' = '3months'
): Promise<Map<number, PricePrediction>> {
  const predictions = new Map<number, PricePrediction>();

  for (const modelId of modelIds) {
    const prediction = await predictPrice(modelId, timeframe);
    if (prediction) {
      predictions.set(modelId, prediction);
    }
  }

  return predictions;
}

/**
 * Koleksiyon değer tahmini
 */
export async function predictCollectionValue(
  collectionId: number,
  timeframe: '1month' | '3months' | '6months' | '1year' = '3months'
): Promise<{
  currentValue: number;
  predictedValue: number;
  change: number;
  changePercent: number;
} | null> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      models: {
        where: { owned: true },
      },
    },
  });

  if (!collection) {
    return null;
  }

  let currentValue = 0;
  let predictedValue = 0;

  for (const model of collection.models) {
    const price = Math.max(model.packedPrice || 0, model.loosePrice || 0);
    currentValue += price;

    const prediction = await predictPrice(model.id, timeframe);
    if (prediction) {
      predictedValue += prediction.predictedPrice;
    } else {
      predictedValue += price; // Tahmin yoksa mevcut fiyatı kullan
    }
  }

  const change = predictedValue - currentValue;
  const changePercent = currentValue > 0 ? (change / currentValue) * 100 : 0;

  return {
    currentValue,
    predictedValue,
    change,
    changePercent,
  };
}




