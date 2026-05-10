'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CollectionDistributionChart } from './charts/CollectionDistributionChart';
import { YearDistributionChart } from './charts/YearDistributionChart';
import { TimelineChart } from './charts/TimelineChart';
import type {
  CollectionDistribution,
  YearDistribution,
  TimelineData,
  TopSeries,
  THSTHRatio,
  CompletionStats,
} from '@/features/analytics/analytics.service';

interface AnalyticsDashboardProps {
  collectionDistribution: CollectionDistribution[];
  yearDistribution: YearDistribution[];
  timelineData: TimelineData[];
  topSeries: TopSeries[];
  thsthRatio: THSTHRatio;
  completionStats: CompletionStats;
  selectedYear?: number; // Yıl filtresi bilgisi
}

export function AnalyticsDashboard({
  collectionDistribution,
  yearDistribution,
  timelineData,
  topSeries,
  thsthRatio,
  completionStats,
  selectedYear,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Completion Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Koleksiyon Tamamlanma Oranı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Packed</span>
                <span>
                  {completionStats.packedOwnedVariants} / {completionStats.totalVariants}
                </span>
              </div>
              <Progress
                value={completionStats.packedCompletionPercentage ?? 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                %{(completionStats.packedCompletionPercentage ?? 0).toFixed(1)} tamamlandı
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Loose</span>
                <span>
                  {completionStats.looseOwnedVariants} / {completionStats.totalVariants}
                </span>
              </div>
              <Progress
                value={completionStats.looseCompletionPercentage ?? 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                %{(completionStats.looseCompletionPercentage ?? 0).toFixed(1)} tamamlandı
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Her İkisi De</span>
                <span>
                  {completionStats.bothOwnedVariants} / {completionStats.totalVariants}
                </span>
              </div>
              <Progress
                value={completionStats.bothCompletionPercentage ?? 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                %{(completionStats.bothCompletionPercentage ?? 0).toFixed(1)} tamamlandı
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Modeller</span>
                <span>
                  {completionStats.wishlistedModels} wishlist
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Toplam {completionStats.totalModels} model
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TH/STH İstatistikleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Treasure Hunt</span>
                <span>{thsthRatio.totalTH}</span>
              </div>
              <Progress value={thsthRatio.thPercentage ?? 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                %{(thsthRatio.thPercentage ?? 0).toFixed(2)} oranında
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Super Treasure Hunt</span>
                <span>{thsthRatio.totalSTH}</span>
              </div>
              <Progress value={thsthRatio.sthPercentage ?? 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                %{(thsthRatio.sthPercentage ?? 0).toFixed(2)} oranında
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Toplam {thsthRatio.totalVariants} varyant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Koleksiyon Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionDistributionChart data={collectionDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yıl Bazında Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            <YearDistributionChart
              data={yearDistribution.map((y) => ({
                year: y.year,
                count: y.count,
                ownedCount: y.packedOwnedCount,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zaman İçinde Büyüme</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineChart data={timelineData} />
        </CardContent>
      </Card>

      {/* Top Series */}
      <Card>
        <CardHeader>
          <CardTitle>En Çok Sahip Olunan Seriler (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topSeries.map((series, index) => {
              const percentage =
                series.count > 0
                  ? ((series.packedOwnedCount / series.count) * 100).toFixed(2)
                  : '0.00';

              const targetYear = selectedYear ?? series.year;

              return (
                <Link
                  key={`${series.name}-${series.year || 'all'}-${index}`}
                  href={{
                    pathname: '/variants',
                    query: {
                      collection: series.name,
                      ...(targetYear ? { year: String(targetYear) } : {}),
                    },
                  }}
                  className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-accent/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    <span className="text-sm underline-offset-2 hover:underline">
                      {series.name}
                      {!selectedYear && series.year && ` (${series.year})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {series.packedOwnedCount} / {series.count}
                    </span>
                    <div className="w-24">
                      <Progress
                        value={
                          series.count > 0
                            ? (series.packedOwnedCount / series.count) * 100
                            : 0
                        }
                        className="h-2"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      %{percentage}
                    </span>
                  </div>
                </Link>
              );
            })}
            {topSeries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Veri bulunamadı
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

