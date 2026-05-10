import prisma from '@/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import YearSelectForm from './year-select-form';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ValueAnalysis } from '@/components/ValueAnalysis';
import { ProfitLossWidget } from '@/components/ProfitLossWidget';
import { TopProfitableWidget } from '@/components/TopProfitableWidget';
import { ValueLossWidget } from '@/components/ValueLossWidget';
import { CollectionProfitabilityWidget } from '@/components/CollectionProfitabilityWidget';
import { InvestmentSummaryWidget } from '@/components/InvestmentSummaryWidget';
import { BuySellRecommendationsWidget } from '@/components/BuySellRecommendationsWidget';
import { PriceTrendChart } from '@/components/PriceTrendChart';
import { PriceAlertsWidget } from '@/components/PriceAlertsWidget';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';
import {
  getCollectionDistribution,
  getYearDistribution,
  getTimelineData,
  getTopSeries,
  getTHSTHRatio,
  getCompletionStats,
} from '@/features/analytics/analytics.service';
import {
  getTotalCollectionValue,
  getCollectionValueDistribution,
  getTopValuableModels,
  getTopValuableVariants,
  getValueTrend,
} from '@/features/analytics/value.service';
import {
  getProfitLossSummary,
  getTopProfitableItems,
  getValueLossItems,
  getCollectionProfitability,
} from '@/features/analytics/profit.service';
import {
  getInvestmentSummary,
  getBuyRecommendations,
  getSellRecommendations,
} from '@/features/analytics/investment.service';
import {
  getPriceTrendByYear,
  getPriceAlertsSummary,
} from '@/features/analytics/price-trend.service';

type HomePageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Page({ searchParams }: HomePageProps) {
  try {
    const params = await searchParams;
    const yearParam = params?.year as string | undefined;
    const selectedYear = yearParam ? Number(yearParam) : undefined;

    const years = await prisma.year.findMany({
      orderBy: { year: 'desc' },
    });

    // Yıl filtresi için where koşulu
    const yearFilter = selectedYear ? { year: selectedYear } : {};

    const [
      totalModels,
      totalVariants,
      packedOwnedVariants,
      looseOwnedVariants,
      bothOwnedVariants,
      wishlistCount,
      collectionsWithSubSeries,
      collectionDistribution,
      yearDistribution,
      timelineData,
      topSeries,
      thsthRatio,
      completionStats,
      totalCollectionValue,
      collectionValueDistribution,
      topValuableModels,
      topValuableVariants,
      valueTrend,
      profitLossSummary,
      topProfitableItems,
      valueLossItems,
      collectionProfitability,
      investmentSummary,
      buyRecommendations,
      sellRecommendations,
      priceTrendData,
      priceAlertsSummary,
    ] = await Promise.all([
      prisma.model.count({
        where: selectedYear
          ? {
              variants: {
                some: {
                  year: selectedYear,
                },
              },
            }
          : {},
      }),
      prisma.variant.count({ where: yearFilter }),
      prisma.variant.count({ where: { ...yearFilter, packedOwned: true } }),
      prisma.variant.count({ where: { ...yearFilter, looseOwned: true } }),
      prisma.variant.count({ where: { ...yearFilter, packedOwned: true, looseOwned: true } }),
      prisma.variant.count({
        where: {
          ...yearFilter,
          wishlisted: true,
        },
      }),
      prisma.collection.findMany({
        where: selectedYear
          ? {
              year: {
                year: selectedYear,
              },
            }
          : {},
        include: {
          year: true,
          subSeries: {
            include: {
              models: {
                include: {
                  variants: {
                    where: yearFilter,
                  },
                },
              },
            },
          },
          models: {
            include: {
              variants: {
                where: yearFilter,
              },
            },
          },
        },
      }),
      getCollectionDistribution(selectedYear),
      getYearDistribution(),
      getTimelineData(),
      getTopSeries(10, selectedYear),
      getTHSTHRatio(selectedYear),
      getCompletionStats(selectedYear),
      getTotalCollectionValue(selectedYear),
      getCollectionValueDistribution(selectedYear),
      getTopValuableModels(10, selectedYear),
      getTopValuableVariants(10, selectedYear),
      getValueTrend(),
      getProfitLossSummary(selectedYear),
      getTopProfitableItems(10, selectedYear),
      getValueLossItems(10, selectedYear),
      getCollectionProfitability(selectedYear),
      getInvestmentSummary(selectedYear),
      getBuyRecommendations(10, selectedYear),
      getSellRecommendations(10, selectedYear),
      getPriceTrendByYear(),
      getPriceAlertsSummary(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Hot Wheels Koleksiyon Paneli</h2>
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Özelleştirilebilir Dashboard
            </Button>
          </Link>
          <YearSelectForm years={years} selectedYear={selectedYear} />
        </div>
      </div>

      {/* Genel istatistikler */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Varyant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Packed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packedOwnedVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Loose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{looseOwnedVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Her İkisi De
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bothOwnedVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wish List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wishlistCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedYear ? `${selectedYear} ` : 'Tüm Yıllar '}Koleksiyonlara Göre Durum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Koleksiyon</TableHead>
                <TableHead>Toplam Alt Seri</TableHead>
                <TableHead>Toplam Varyant</TableHead>
                <TableHead>Packed</TableHead>
                <TableHead>Loose</TableHead>
                <TableHead>Wish List</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // Eğer "Tüm Yıllar" seçiliyse, koleksiyonları isme göre grupla
                if (!selectedYear) {
                  // Koleksiyonları isme göre grupla
                  const groupedCollections = new Map<string, {
                    collectionName: string;
                    subSeriesCount: number;
                    totalVariants: number;
                    packedOwnedVariants: number;
                    looseOwnedVariants: number;
                    wishlistCount: number;
                  }>();

                  // SubSeries'i olan koleksiyonları işle
                  collectionsWithSubSeries.forEach((collection: any) => {
                    // Tüm alt serilerdeki varyantları topla
                    const allVariants = collection.subSeries?.flatMap((ss: any) =>
                      ss.models?.flatMap((m: any) => m.variants) || []
                    ) || [];
                    const totalVariants = allVariants.length;
                    const packedOwnedVariants = allVariants.filter((v: any) => v?.packedOwned).length;
                    const looseOwnedVariants = allVariants.filter((v: any) => v?.looseOwned).length;
                    const subSeriesCount = (collection.subSeries || []).filter((ss: any) => {
                      // En az bir varyantı olan alt serileri say
                      const ssVariants = (ss.models || []).flatMap((m: any) => m?.variants || []);
                      return ssVariants.length > 0;
                    }).length;
                    
                    // Wishlist sayısını hesapla (Model seviyesinde)
                    const allModels = (collection.subSeries || []).flatMap((ss: any) => ss?.models || []);
                    const wishlistCount = allModels.filter((m: any) => m?.wishlisted).length;

                    const collectionName = collection.name;
                    
                    // Eğer bu koleksiyon ismi daha önce eklenmemişse, ekle
                    if (!groupedCollections.has(collectionName)) {
                      groupedCollections.set(collectionName, {
                        collectionName,
                        subSeriesCount: 0,
                        totalVariants: 0,
                        packedOwnedVariants: 0,
                        looseOwnedVariants: 0,
                        wishlistCount: 0,
                      });
                    }
                    
                    // Mevcut değerlere ekle
                    const existing = groupedCollections.get(collectionName)!;
                    existing.subSeriesCount += subSeriesCount;
                    existing.totalVariants += totalVariants;
                    existing.packedOwnedVariants += packedOwnedVariants;
                    existing.looseOwnedVariants += looseOwnedVariants;
                    existing.wishlistCount += wishlistCount;
                  });

                  // SubSeries'i olmayan koleksiyonları da ekle
                  collectionsWithSubSeries.forEach((collection: any) => {
                    // Eğer SubSeries yoksa, direkt modellerden varyantları al
                    if (!collection.subSeries || collection.subSeries.length === 0) {
                      const allVariants = (collection.models || []).flatMap((m: any) => m?.variants || []);
                      const totalVariants = allVariants.length;
                      const packedOwnedVariants = allVariants.filter((v: any) => v?.packedOwned).length;
                      const looseOwnedVariants = allVariants.filter((v: any) => v?.looseOwned).length;
                      const wishlistCount = (collection.models || []).filter((m: any) => m?.wishlisted).length;

                      const collectionName = collection.name;
                      
                      if (!groupedCollections.has(collectionName)) {
                        groupedCollections.set(collectionName, {
                          collectionName,
                          subSeriesCount: 0,
                          totalVariants: 0,
                          packedOwnedVariants: 0,
                          looseOwnedVariants: 0,
                          wishlistCount: 0,
                        });
                      }
                      
                      const existing = groupedCollections.get(collectionName)!;
                      existing.totalVariants += totalVariants;
                      existing.packedOwnedVariants += packedOwnedVariants;
                      existing.looseOwnedVariants += looseOwnedVariants;
                      existing.wishlistCount += wishlistCount;
                    }
                  });

                  // Gruplanmış koleksiyonları sırala ve göster
                  return Array.from(groupedCollections.values())
                    .filter((row) => row.totalVariants > 0)
                    .sort((a, b) => b.totalVariants - a.totalVariants)
                    .map((row, index) => {
                      const packedPercentage = row.totalVariants > 0 
                        ? ((row.packedOwnedVariants / row.totalVariants) * 100).toFixed(2)
                        : '0.00';
                      const loosePercentage = row.totalVariants > 0 
                        ? ((row.looseOwnedVariants / row.totalVariants) * 100).toFixed(2)
                        : '0.00';
                      return (
                        <TableRow key={`${row.collectionName}-${index}`}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/variants?collection=${encodeURIComponent(row.collectionName)}`}
                              className="text-primary hover:underline"
                            >
                              {row.collectionName}
                            </Link>
                          </TableCell>
                          <TableCell>{row.subSeriesCount}</TableCell>
                          <TableCell>{row.totalVariants}</TableCell>
                          <TableCell>
                            {row.packedOwnedVariants}{' '}
                            <span className="text-xs text-muted-foreground">(%{packedPercentage})</span>
                          </TableCell>
                          <TableCell>
                            {row.looseOwnedVariants}{' '}
                            <span className="text-xs text-muted-foreground">(%{loosePercentage})</span>
                          </TableCell>
                          <TableCell>{row.wishlistCount}</TableCell>
                        </TableRow>
                    );
                  });
                } else {
                  // Belirli bir yıl seçiliyse, mevcut mantığı kullan
                  return collectionsWithSubSeries
                    .map((collection: any) => {
                      // SubSeries varsa, alt serilerden varyantları topla
                      let allVariants: any[] = [];
                      let subSeriesCount = 0;
                      let wishlistCount = 0;
                      
                      if (collection.subSeries && collection.subSeries.length > 0) {
                        allVariants = (collection.subSeries || []).flatMap((ss: any) =>
                          (ss?.models || []).flatMap((m: any) => m?.variants || [])
                        );
                        subSeriesCount = (collection.subSeries || []).filter((ss: any) => {
                          const ssVariants = (ss?.models || []).flatMap((m: any) => m?.variants || []);
                          return ssVariants.length > 0;
                        }).length;
                        const allModels = (collection.subSeries || []).flatMap((ss: any) => ss?.models || []);
                        wishlistCount = allModels.filter((m: any) => m?.wishlisted).length;
                      } else {
                        // SubSeries yoksa, direkt modellerden varyantları al
                        allVariants = (collection.models || []).flatMap((m: any) => m?.variants || []);
                        wishlistCount = (collection.models || []).filter((m: any) => m?.wishlisted).length;
                      }
                      
                      const totalVariants = allVariants.length;
                      const packedOwnedVariants = allVariants.filter((v: any) => v?.packedOwned).length;
                      const looseOwnedVariants = allVariants.filter((v: any) => v?.looseOwned).length;

                      return {
                        id: collection.id,
                        collectionName: collection.name,
                        subSeriesCount,
                        totalVariants,
                        packedOwnedVariants,
                        looseOwnedVariants,
                        wishlistCount,
                      };
                    })
                    .filter((row) => row.totalVariants > 0)
                    .sort((a, b) => b.totalVariants - a.totalVariants)
                    .map((row) => {
                      const packedPercentage = row.totalVariants > 0 
                        ? ((row.packedOwnedVariants / row.totalVariants) * 100).toFixed(2)
                        : '0.00';
                      const loosePercentage = row.totalVariants > 0 
                        ? ((row.looseOwnedVariants / row.totalVariants) * 100).toFixed(2)
                        : '0.00';
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/variants?collection=${encodeURIComponent(row.collectionName)}${selectedYear ? `&year=${selectedYear}` : ''}`}
                              className="text-primary hover:underline"
                            >
                              {row.collectionName}
                            </Link>
                          </TableCell>
                          <TableCell>{row.subSeriesCount}</TableCell>
                          <TableCell>{row.totalVariants}</TableCell>
                          <TableCell>
                            {row.packedOwnedVariants}{' '}
                            <span className="text-xs text-muted-foreground">(%{packedPercentage})</span>
                          </TableCell>
                          <TableCell>
                            {row.looseOwnedVariants}{' '}
                            <span className="text-xs text-muted-foreground">(%{loosePercentage})</span>
                          </TableCell>
                          <TableCell>{row.wishlistCount}</TableCell>
                        </TableRow>
                      );
                    });
                }
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard
        collectionDistribution={collectionDistribution}
        yearDistribution={yearDistribution}
        timelineData={timelineData}
        topSeries={topSeries}
        thsthRatio={thsthRatio}
        completionStats={completionStats}
        selectedYear={selectedYear}
      />

      {/* Value Analysis */}
      <ValueAnalysis
        totalValue={totalCollectionValue}
        collectionValues={collectionValueDistribution}
        topValuableModels={topValuableModels}
        topValuableVariants={topValuableVariants}
        valueTrend={valueTrend}
      />

      {/* Profit/Loss Analysis Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Kâr/Zarar Analizi</h3>
        
        {/* Investment Summary & Profit/Loss Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <InvestmentSummaryWidget summary={investmentSummary} />
          <ProfitLossWidget summary={profitLossSummary} />
        </div>

        {/* Top Profitable & Value Loss */}
        <div className="grid gap-4 md:grid-cols-2">
          <TopProfitableWidget items={topProfitableItems} />
          <ValueLossWidget items={valueLossItems} />
        </div>

        {/* Collection Profitability */}
        <CollectionProfitabilityWidget collections={collectionProfitability} />

        {/* Buy/Sell Recommendations */}
        <BuySellRecommendationsWidget
          buyRecommendations={buyRecommendations}
          sellRecommendations={sellRecommendations}
        />

        {/* Price Trend & Alerts */}
        <div className="grid gap-4 md:grid-cols-2">
          <PriceTrendChart data={priceTrendData} />
          <PriceAlertsWidget summary={priceAlertsSummary} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Detaylı liste ve filtreler için{' '}
        <a href="/variants" className="text-primary underline underline-offset-4 hover:no-underline">
          Varyantlar sayfasını
        </a>{' '}
        kullanabilirsiniz.
      </p>
    </div>
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Hot Wheels Koleksiyon Paneli</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Dashboard yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.
          </CardContent>
        </Card>
      </div>
    );
  }
}
