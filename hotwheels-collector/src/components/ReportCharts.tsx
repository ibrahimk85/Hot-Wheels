'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CollectionDistributionChart } from './charts/CollectionDistributionChart';
import { YearDistributionChart } from './charts/YearDistributionChart';
import { TimelineChart } from './charts/TimelineChart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  SummaryReportData,
  ValueReportData,
  CollectionReportData,
  YearReportData,
} from '@/features/reports/report.service';
import {
  transformSummaryToCollectionChart,
  transformSummaryToYearChart,
  transformValueToTopModelsChart,
  transformValueToCollectionChart,
  transformValueToYearTrendChart,
  transformCollectionToCompletionChart,
  transformYearToCollectionChart,
} from '@/features/reports/report-transformers';

interface ReportChartsProps {
  reportType: string;
  data: any;
}

export function ReportCharts({ reportType, data }: ReportChartsProps) {
  if (reportType === 'summary' && data as SummaryReportData) {
    const summaryData = data as SummaryReportData;
    const collectionChartData = transformSummaryToCollectionChart(summaryData);
    const yearChartData = transformSummaryToYearChart(summaryData);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Koleksiyon Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionDistributionChart data={collectionChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yıl Bazlı Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            <YearDistributionChart data={yearChartData} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reportType === 'value' && data as ValueReportData) {
    const valueData = data as ValueReportData;
    const topModelsData = transformValueToTopModelsChart(valueData, 10);
    const collectionChartData = transformValueToCollectionChart(valueData);
    const yearTrendData = transformValueToYearTrendChart(valueData);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>En Değerli Modeller (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topModelsData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} TL`, 'Değer']}
                />
                <Bar dataKey="value" fill="#8884d8" name="Değer (TL)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Koleksiyon Bazlı Değer Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionDistributionChart data={collectionChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yıl Bazlı Değer Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={yearTrendData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} TL`, 'Değer']}
                />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" name="Toplam Değer (TL)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reportType === 'collection' && data as CollectionReportData) {
    const collectionData = data as CollectionReportData;
    const completionData = transformCollectionToCompletionChart(collectionData);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tamamlanma Oranları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completionData.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{item.name === 'Models' ? 'Modeller' : 'Varyantlar'}</span>
                  <span>
                    {item.owned} / {item.total}
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  %{item.percentage.toFixed(1)} tamamlandı
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reportType === 'year' && data as YearReportData) {
    const yearData = data as YearReportData;
    const collectionChartData = transformYearToCollectionChart(yearData);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Koleksiyon Dağılımı ({yearData.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionDistributionChart data={collectionChartData} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}








