'use client';

import { useState, useEffect } from 'react';
import { InvestmentAnalysis } from '@/components/InvestmentAnalysis';
import { CompletionRate } from '@/components/CompletionRate';
import { TimelineChart, type TimelineChartData } from '@/components/charts/TimelineChart';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Loader2 } from 'lucide-react';
import { type GrowthTimelineData } from '@/features/analytics/advanced-stats.service';

interface HeatmapData {
  year: number;
  month: number;
  value: number;
}

export default function AnalyticsPage() {
  const [timelineData, setTimelineData] = useState<TimelineChartData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      const [timelineResponse, valueByYearResponse] = await Promise.all([
        fetch('/api/analytics/advanced-stats?type=growth-timeline&months=12'),
        fetch('/api/analytics/advanced-stats?type=by-year'),
      ]);

      if (timelineResponse.ok) {
        const timeline: GrowthTimelineData[] = await timelineResponse.json();
        // GrowthTimelineData ve TimelineChartData aynı yapıda
        const formatted: TimelineChartData[] = timeline.map((item) => ({
          month: item.month,
          count: item.count,
          value: item.value,
        }));
        setTimelineData(formatted);
      }

      if (valueByYearResponse.ok) {
        const byYear = await valueByYearResponse.json();
        // Heatmap için veri hazırla
        const heatmap: HeatmapData[] = byYear.map((item: { year: number; value: number }) => ({
          year: item.year,
          month: 1, // Basit implementasyon - gerçek uygulamada aylara göre dağıtılmalı
          value: item.value,
        }));
        setHeatmapData(heatmap);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Gelişmiş İstatistikler ve Analitik</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yatırım Analizi</CardTitle>
          <CardDescription>
            Koleksiyonunuzun yatırım performansını analiz edin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvestmentAnalysis />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tamamlanma Oranı</CardTitle>
          <CardDescription>
            Koleksiyonlarınızın tamamlanma durumunu görüntüleyin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompletionRate />
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Grafikler yükleniyor...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {timelineData.length > 0 && (
            <TimelineChart
              data={timelineData}
              title="Koleksiyon Büyüme Zaman Çizelgesi"
            />
          )}
          {heatmapData.length > 0 && (
            <HeatmapChart
              data={heatmapData}
              title="Yıllara Göre Koleksiyon Değeri (Heatmap)"
            />
          )}
        </>
      )}
    </div>
  );
}

