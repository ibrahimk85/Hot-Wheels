import prisma from '@/db';
import { getPriceHistoryForModel, getPriceHistoryForVariant } from '@/features/integrations/integration.service';

export interface PriceTrend {
  date: Date;
  price: number;
  source: string;
}

export interface MarketAnalysis {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  priceChange: number;
  priceChangePercent: number;
  dataPoints: number;
}

/**
 * Model için fiyat trend analizi
 */
export async function getPriceTrendForModel(
  modelId: number,
  days: number = 30
): Promise<PriceTrend[]> {
  const priceHistory = await getPriceHistoryForModel(modelId);
  
  // Son N günün verilerini filtrele
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filtered = priceHistory
    .filter((ph) => new Date(ph.recordedAt) >= cutoffDate)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  return filtered.map((ph) => ({
    date: new Date(ph.recordedAt),
    price: ph.price,
    source: ph.source,
  }));
}

/**
 * Varyant için fiyat trend analizi
 */
export async function getPriceTrendForVariant(
  variantId: number,
  days: number = 30
): Promise<PriceTrend[]> {
  const priceHistory = await getPriceHistoryForVariant(variantId);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filtered = priceHistory
    .filter((ph) => new Date(ph.recordedAt) >= cutoffDate)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  return filtered.map((ph) => ({
    date: new Date(ph.recordedAt),
    price: ph.price,
    source: ph.source,
  }));
}

/**
 * Piyasa analizi
 */
export async function getMarketAnalysis(
  modelId?: number,
  variantId?: number,
  days: number = 30
): Promise<MarketAnalysis | null> {
  let priceHistory;

  if (variantId) {
    priceHistory = await getPriceHistoryForVariant(variantId);
  } else if (modelId) {
    priceHistory = await getPriceHistoryForModel(modelId);
  } else {
    return null;
  }

  if (priceHistory.length === 0) {
    return null;
  }

  // Son N günün verilerini filtrele
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filtered = priceHistory.filter(
    (ph) => new Date(ph.recordedAt) >= cutoffDate
  );

  if (filtered.length === 0) {
    return null;
  }

  const prices = filtered.map((ph) => ph.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Trend analizi
  const sorted = filtered.sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const firstAvg = firstHalf.reduce((sum, ph) => sum + ph.price, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, ph) => sum + ph.price, 0) / secondHalf.length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (secondAvg > firstAvg * 1.05) {
    trend = 'increasing';
  } else if (secondAvg < firstAvg * 0.95) {
    trend = 'decreasing';
  }

  const priceChange = secondAvg - firstAvg;
  const priceChangePercent = firstAvg > 0 ? (priceChange / firstAvg) * 100 : 0;

  return {
    averagePrice,
    minPrice,
    maxPrice,
    trend,
    priceChange,
    priceChangePercent,
    dataPoints: filtered.length,
  };
}

/**
 * Farklı kaynaklardan fiyat karşılaştırması
 */
export async function comparePricesFromSources(
  modelId?: number,
  variantId?: number
): Promise<Record<string, { price: number; count: number; latestDate: Date }>> {
  let priceHistory;

  if (variantId) {
    priceHistory = await getPriceHistoryForVariant(variantId);
  } else if (modelId) {
    priceHistory = await getPriceHistoryForModel(modelId);
  } else {
    return {};
  }

  // Kaynaklara göre grupla
  const bySource: Record<string, typeof priceHistory> = {};
  
  for (const ph of priceHistory) {
    if (!bySource[ph.source]) {
      bySource[ph.source] = [];
    }
    bySource[ph.source].push(ph);
  }

  const result: Record<string, { price: number; count: number; latestDate: Date }> = {};

  for (const [source, prices] of Object.entries(bySource)) {
    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const latest = prices.sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    )[0];

    result[source] = {
      price: avgPrice,
      count: prices.length,
      latestDate: new Date(latest.recordedAt),
    };
  }

  return result;
}

/**
 * Otomatik fiyat güncelleme (scheduled job için)
 */
export async function updatePricesForModel(modelId: number): Promise<void> {
  // Bu fonksiyon bir cron job veya scheduled task tarafından çağrılabilir
  // Şu anda sadece placeholder - gerçek implementasyon eBay/Marketplace scraping içerecek
  
  const model = await prisma.model.findUnique({
    where: { id: modelId },
  });

  if (!model) {
    return;
  }

  // Fiyat geçmişi kaydetme işlemi
  // Gerçek implementasyonda:
  // 1. eBay API'den fiyat çek
  // 2. Marketplace'lerden fiyat çek
  // 3. PriceHistory'ye kaydet
  // 4. PriceAlert'leri kontrol et
}



