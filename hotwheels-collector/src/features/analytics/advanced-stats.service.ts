import prisma from '@/db';
import { getMarketPrice } from './price-helper';

export interface AdvancedStats {
  totalValue: number;
  averageValuePerModel: number;
  averageValuePerVariant: number;
  mostValuableModel: {
    id: number;
    name: string;
    value: number;
  } | null;
  leastValuableModel: {
    id: number;
    name: string;
    value: number;
  } | null;
  valueDistribution: {
    range: string;
    count: number;
  }[];
  growthRate: number;
  growthRatePercent: number;
}

/**
 * Gelişmiş istatistikler
 */
export async function getAdvancedStats(
  year?: number
): Promise<AdvancedStats> {
  const whereClause: any = { owned: true };
  
  if (year) {
    whereClause.variants = {
      some: {
        year: year,
      },
    };
  }

  const models = await prisma.model.findMany({
    where: whereClause,
    include: {
      variants: {
        where: { owned: true },
      },
    },
  });

  // Toplam değer
  const totalValue = models.reduce((sum, model) => {
    const modelValue = getMarketPrice(model);
    return sum + modelValue;
  }, 0);

  // Ortalama değerler
  const averageValuePerModel = models.length > 0 ? totalValue / models.length : 0;
  const totalVariants = models.reduce((sum, model) => sum + model.variants.length, 0);
  const averageValuePerVariant = totalVariants > 0 ? totalValue / totalVariants : 0;

  // En değerli model
  const modelsWithValue = models
    .map((model) => ({
      id: model.id,
      name: model.castingName,
      value: Math.max(model.packedPrice || 0, model.loosePrice || 0),
    }))
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value);

  const mostValuableModel = modelsWithValue.length > 0 ? modelsWithValue[0] : null;
  const leastValuableModel = modelsWithValue.length > 0 ? modelsWithValue[modelsWithValue.length - 1] : null;

  // Değer dağılımı
  const ranges = [
    { min: 0, max: 10, label: '0-10 TL' },
    { min: 10, max: 25, label: '10-25 TL' },
    { min: 25, max: 50, label: '25-50 TL' },
    { min: 50, max: 100, label: '50-100 TL' },
    { min: 100, max: 200, label: '100-200 TL' },
    { min: 200, max: Infinity, label: '200+ TL' },
  ];

  const valueDistribution = ranges.map((range) => ({
    range: range.label,
    count: modelsWithValue.filter(
      (m) => m.value >= range.min && m.value < range.max
    ).length,
  }));

  // Büyüme oranı (basit hesaplama - gerçek uygulamada geçmiş verilerle karşılaştırılmalı)
  const growthRate = 0; // Placeholder
  const growthRatePercent = 0; // Placeholder

  return {
    totalValue,
    averageValuePerModel,
    averageValuePerVariant,
    mostValuableModel,
    leastValuableModel,
    valueDistribution,
    growthRate,
    growthRatePercent,
  };
}

/**
 * Yıllara göre koleksiyon değeri
 */
export async function getValueByYear(): Promise<
  Array<{ year: number; value: number; count: number }>
> {
  const models = await prisma.model.findMany({
    where: { owned: true },
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
    },
  });

  const byYear = new Map<number, { value: number; count: number }>();

  for (const model of models) {
    const year = model.subSeries?.collection.year.year || 0;
    const value = Math.max(model.packedPrice || 0, model.loosePrice || 0);

    if (!byYear.has(year)) {
      byYear.set(year, { value: 0, count: 0 });
    }

    const current = byYear.get(year)!;
    current.value += value;
    current.count += 1;
  }

  return Array.from(byYear.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Koleksiyonlara göre değer dağılımı
 */
export async function getValueByCollection(): Promise<
  Array<{ collection: string; value: number; count: number; percentage: number }>
> {
  const models = await prisma.model.findMany({
    where: { owned: true },
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
    },
  });

  const totalValue = models.reduce((sum, model) => {
    return sum + Math.max(model.packedPrice || 0, model.loosePrice || 0);
  }, 0);

  const byCollection = new Map<
    string,
    { value: number; count: number }
  >();

  for (const model of models) {
    const collectionName = model.subSeries?.collection.name || 'Unknown';
    const value = Math.max(model.packedPrice || 0, model.loosePrice || 0);

    if (!byCollection.has(collectionName)) {
      byCollection.set(collectionName, { value: 0, count: 0 });
    }

    const current = byCollection.get(collectionName)!;
    current.value += value;
    current.count += 1;
  }

  return Array.from(byCollection.entries())
    .map(([collection, data]) => ({
      collection,
      ...data,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Zaman içinde koleksiyon büyümesi
 */
export interface GrowthTimelineData {
  month: string;
  count: number;
  value: number;
}

export async function getCollectionGrowthTimeline(
  months: number = 12
): Promise<GrowthTimelineData[]> {
  // Basit implementasyon - gerçek uygulamada createdAt tarihlerine göre hesaplanmalı
  const models = await prisma.model.findMany({
    where: { owned: true },
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
    },
  });

  // Yıllara göre grupla
  const byYear = new Map<number, { count: number; value: number }>();

  for (const model of models) {
    const year = model.subSeries?.collection.year.year || 0;
    const value = Math.max(model.packedPrice || 0, model.loosePrice || 0);

    if (!byYear.has(year)) {
      byYear.set(year, { count: 0, value: 0 });
    }

    const current = byYear.get(year)!;
    current.count += 1;
    current.value += value;
  }

  return Array.from(byYear.entries())
    .map(([year, data]) => ({
      month: year.toString(),
      ...data,
    }))
    .sort((a, b) => parseInt(a.month) - parseInt(b.month))
    .slice(-months);
}

