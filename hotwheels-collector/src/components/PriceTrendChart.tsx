'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import type { PriceTrendData } from '@/features/analytics/price-trend.service';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PriceTrendChartProps {
  data: PriceTrendData[];
  title?: string;
}

export function PriceTrendChart({ data, title = 'Fiyat Trend Analizi' }: PriceTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Trend verisi bulunamadı
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    period: item.period,
    'Ortalama Piyasa Fiyatı': Number(item.averageMarketPrice.toFixed(2)),
    'Ortalama Alış Fiyatı': Number(item.averagePurchasePrice.toFixed(2)),
    'Fiyat Değişimi': Number(item.priceChange.toFixed(2)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatPrice(value)}
            />
            <Tooltip
              formatter={(value: number) => formatPrice(value)}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Ortalama Piyasa Fiyatı"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Ortalama Alış Fiyatı"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Fiyat Değişimi"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
