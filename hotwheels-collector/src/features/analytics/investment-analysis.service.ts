import prisma from '@/db';
import { getMarketPrice, getPurchasePrice } from './price-helper';

export interface InvestmentAnalysis {
  totalInvestment: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
  roi: number; // Return on Investment
  bestInvestment: {
    id: number;
    name: string;
    purchasePrice: number;
    currentPrice: number;
    profit: number;
    profitPercent: number;
  } | null;
  worstInvestment: {
    id: number;
    name: string;
    purchasePrice: number;
    currentPrice: number;
    profit: number;
    profitPercent: number;
  } | null;
  investmentsByCategory: Array<{
    category: string;
    totalInvestment: number;
    currentValue: number;
    profit: number;
    profitPercent: number;
  }>;
}

/**
 * Yatırım analizi
 */
export async function getInvestmentAnalysis(
  userId?: number
): Promise<InvestmentAnalysis> {
  // Sahip olunan modelleri al
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
      variants: {
        where: { owned: true },
      },
    },
  });

  // Yatırım hesaplama (purchase price ve market price kullanılıyor)
  const investments = models.map((model) => {
    const purchasePrice = getPurchasePrice(model);
    const currentPrice = getMarketPrice(model);
    const profit = currentPrice - purchasePrice;
    const profitPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

    return {
      id: model.id,
      name: model.castingName,
      purchasePrice,
      currentPrice,
      profit,
      profitPercent,
      category: model.subSeries?.collection.name || 'Unknown',
    };
  });

  const totalInvestment = investments.reduce(
    (sum, inv) => sum + inv.purchasePrice,
    0
  );
  const currentValue = investments.reduce(
    (sum, inv) => sum + inv.currentPrice,
    0
  );
  const profit = currentValue - totalInvestment;
  const profitPercent = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
  const roi = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;

  // En iyi yatırım
  const sortedByProfit = [...investments]
    .filter((inv) => inv.purchasePrice > 0)
    .sort((a, b) => b.profit - a.profit);
  const bestInvestment = sortedByProfit.length > 0 ? sortedByProfit[0] : null;

  // En kötü yatırım
  const worstInvestment = sortedByProfit.length > 0 ? sortedByProfit[sortedByProfit.length - 1] : null;

  // Kategoriye göre yatırım analizi
  const byCategory = new Map<
    string,
    { totalInvestment: number; currentValue: number }
  >();

  for (const inv of investments) {
    if (!byCategory.has(inv.category)) {
      byCategory.set(inv.category, { totalInvestment: 0, currentValue: 0 });
    }

    const current = byCategory.get(inv.category)!;
    current.totalInvestment += inv.purchasePrice;
    current.currentValue += inv.currentPrice;
  }

  const investmentsByCategory = Array.from(byCategory.entries()).map(
    ([category, data]) => ({
      category,
      ...data,
      profit: data.currentValue - data.totalInvestment,
      profitPercent:
        data.totalInvestment > 0
          ? ((data.currentValue - data.totalInvestment) / data.totalInvestment) * 100
          : 0,
    })
  );

  return {
    totalInvestment,
    currentValue,
    profit,
    profitPercent,
    roi,
    bestInvestment,
    worstInvestment,
    investmentsByCategory,
  };
}

/**
 * ROI (Return on Investment) hesaplama
 */
export async function calculateROI(
  modelId: number
): Promise<{ roi: number; profit: number; profitPercent: number } | null> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
  });

  if (!model || !model.owned) {
    return null;
  }

  const purchasePrice = getPurchasePrice(model);
  const currentPrice = getMarketPrice(model);

  if (purchasePrice === 0) {
    return null;
  }

  const profit = currentPrice - purchasePrice;
  const profitPercent = (profit / purchasePrice) * 100;
  const roi = profitPercent;

  return { roi, profit, profitPercent };
}

/**
 * Koleksiyon değer tahmini (gelecek değer)
 */
export async function estimateCollectionValue(
  months: number = 12
): Promise<{
  currentValue: number;
  estimatedValue: number;
  estimatedGrowth: number;
  estimatedGrowthPercent: number;
}> {
  const models = await prisma.model.findMany({
    where: { owned: true },
  });

  const currentValue = models.reduce((sum, model) => {
    return sum + Math.max(model.packedPrice || 0, model.loosePrice || 0);
  }, 0);

  // Basit tahmin: Yıllık %5 artış varsayımı
  const annualGrowthRate = 0.05;
  const monthlyGrowthRate = annualGrowthRate / 12;
  const estimatedGrowth = currentValue * monthlyGrowthRate * months;
  const estimatedValue = currentValue + estimatedGrowth;
  const estimatedGrowthPercent = (estimatedGrowth / currentValue) * 100;

  return {
    currentValue,
    estimatedValue,
    estimatedGrowth,
    estimatedGrowthPercent,
  };
}



