import prisma from '@/db';

export interface PriceData {
  price: number;
  currency: string;
  source: string;
  url?: string;
}

/**
 * Fiyat geçmişi kaydet
 */
export async function savePriceHistory(
  variantId: number | null,
  modelId: number | null,
  priceData: PriceData
) {
  return prisma.priceHistory.create({
    data: {
      variantId,
      modelId,
      source: priceData.source,
      price: priceData.price,
      currency: priceData.currency,
      url: priceData.url,
    },
  });
}

/**
 * Model için fiyat geçmişi getir
 */
export async function getPriceHistoryForModel(modelId: number) {
  return prisma.priceHistory.findMany({
    where: { modelId },
    orderBy: { recordedAt: 'desc' },
    take: 50,
  });
}

/**
 * Varyant için fiyat geçmişi getir
 */
export async function getPriceHistoryForVariant(variantId: number) {
  return prisma.priceHistory.findMany({
    where: { variantId },
    orderBy: { recordedAt: 'desc' },
    take: 50,
  });
}

/**
 * Ortalama fiyat hesapla
 */
export async function getAveragePrice(
  variantId: number | null,
  modelId: number | null,
  source?: string
) {
  const where: any = {};
  if (variantId) where.variantId = variantId;
  if (modelId) where.modelId = modelId;
  if (source) where.source = source;

  const prices = await prisma.priceHistory.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: 30, // Son 30 kayıt
  });

  if (prices.length === 0) return null;

  const sum = prices.reduce((acc, p) => acc + p.price, 0);
  const avg = sum / prices.length;

  return {
    average: avg,
    count: prices.length,
    min: Math.min(...prices.map((p) => p.price)),
    max: Math.max(...prices.map((p) => p.price)),
    latest: prices[0],
  };
}

/**
 * Hot Wheels Wiki'den fiyat bilgisi çek (basit scraping)
 */
export async function fetchPriceFromWiki(modelName: string): Promise<PriceData | null> {
  try {
    // Bu basit bir örnek, gerçek implementasyon için wiki sayfasını parse etmek gerekir
    // Şimdilik null döndürüyoruz, kullanıcı manuel olarak ekleyebilir
    return null;
  } catch (error) {
    console.error('Error fetching price from wiki:', error);
    return null;
  }
}

/**
 * eBay API'den fiyat bilgisi çek (opsiyonel - API key gerekir)
 */
export async function fetchPriceFromEbay(
  searchQuery: string,
  apiKey?: string
): Promise<PriceData | null> {
  if (!apiKey) {
    console.warn('eBay API key not provided');
    return null;
  }

  try {
    // eBay API entegrasyonu burada yapılabilir
    // Şimdilik null döndürüyoruz
    return null;
  } catch (error) {
    console.error('Error fetching price from eBay:', error);
    return null;
  }
}

/**
 * Google Lens ile görsel tanıma (opsiyonel - API key gerekir)
 */
export async function identifyModelFromImage(
  imageUrl: string,
  apiKey?: string
): Promise<{ modelName: string; confidence: number } | null> {
  if (!apiKey) {
    console.warn('Google Lens API key not provided');
    return null;
  }

  try {
    // Google Lens API entegrasyonu burada yapılabilir
    // Şimdilik null döndürüyoruz
    return null;
  } catch (error) {
    console.error('Error identifying model from image:', error);
    return null;
  }
}

/**
 * Fiyat bildirimleri için kontrol et
 */
export async function checkPriceNotifications() {
  // Kullanıcının belirlediği fiyat hedeflerini kontrol et
  // Şimdilik basit bir implementasyon
  return [];
}




