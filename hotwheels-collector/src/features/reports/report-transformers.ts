import type {
  SummaryReportData,
  ValueReportData,
  CollectionReportData,
  YearReportData,
} from './report.service';

// Collection distribution for charts
export interface CollectionChartData {
  name: string;
  count: number;
  percentage: number;
}

// Year distribution for charts
export interface YearChartData {
  year: number;
  count: number;
  ownedCount: number;
}

// Value chart data
export interface ValueChartData {
  name: string;
  value: number;
}

/**
 * Transform summary report data to collection distribution chart format
 */
export function transformSummaryToCollectionChart(
  data: SummaryReportData
): CollectionChartData[] {
  const total = data.collections.reduce((sum, c) => sum + c.variantCount, 0);
  
  return data.collections
    .map((c) => ({
      name: `${c.name} (${c.year})`,
      count: c.variantCount,
      percentage: total > 0 ? (c.variantCount / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Transform summary report data to year distribution chart format
 */
export function transformSummaryToYearChart(
  data: SummaryReportData
): YearChartData[] {
  return data.years
    .map((y) => ({
      year: y.year,
      count: y.variantCount,
      ownedCount: y.ownedCount,
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * Transform value report data to top valuable models chart format
 */
export function transformValueToTopModelsChart(
  data: ValueReportData,
  limit: number = 10
): ValueChartData[] {
  return data.topValuableModels
    .slice(0, limit)
    .map((m) => ({
      name: m.castingName,
      value: m.value,
    }));
}

/**
 * Transform value report data to collection distribution chart format
 */
export function transformValueToCollectionChart(
  data: ValueReportData
): CollectionChartData[] {
  const total = data.byCollection.reduce((sum, c) => sum + c.value, 0);
  
  return data.byCollection
    .map((c) => ({
      name: `${c.name} (${c.year})`,
      count: c.value,
      percentage: total > 0 ? (c.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10
}

/**
 * Transform value report data to year trend chart format
 */
export function transformValueToYearTrendChart(
  data: ValueReportData
): Array<{ year: number; value: number; variantCount: number }> {
  return data.byYear.map((y) => ({
    year: y.year,
    value: y.value,
    variantCount: y.variantCount,
  }));
}

/**
 * Transform collection report data to completion chart format
 */
export function transformCollectionToCompletionChart(
  data: CollectionReportData
): Array<{ name: string; owned: number; total: number; percentage: number }> {
  return [
    {
      name: 'Models',
      owned: data.ownedModels,
      total: data.totalModels,
      percentage:
        data.totalModels > 0
          ? (data.ownedModels / data.totalModels) * 100
          : 0,
    },
    {
      name: 'Variants',
      owned: data.ownedVariants,
      total: data.totalVariants,
      percentage:
        data.totalVariants > 0
          ? (data.ownedVariants / data.totalVariants) * 100
          : 0,
    },
  ];
}

/**
 * Transform year report data to collection distribution chart format
 */
export function transformYearToCollectionChart(
  data: YearReportData
): CollectionChartData[] {
  const total = data.collections.reduce((sum, c) => sum + c.variantCount, 0);
  
  return data.collections
    .map((c) => ({
      name: c.name,
      count: c.variantCount,
      percentage: total > 0 ? (c.variantCount / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}








