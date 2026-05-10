'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart, Bar } from 'recharts';

interface HeatmapData {
  year: number;
  month: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
}

export function HeatmapChart({ data, title }: HeatmapChartProps) {
  // Yıllara göre grupla
  const byYear = new Map<number, HeatmapData[]>();
  
  for (const item of data) {
    if (!byYear.has(item.year)) {
      byYear.set(item.year, []);
    }
    byYear.get(item.year)!.push(item);
  }

  // Grafik verisi hazırla (yıllar x ekseni, değerler y ekseni)
  const chartData = Array.from(byYear.entries()).map(([year, items]) => {
    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    return {
      year: year.toString(),
      value: totalValue,
      count: items.length,
    };
  });

  // Renk skalası (değere göre)
  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity > 0.8) return '#22c55e'; // Yeşil (yüksek)
    if (intensity > 0.6) return '#84cc16'; // Açık yeşil
    if (intensity > 0.4) return '#eab308'; // Sarı
    if (intensity > 0.2) return '#f97316'; // Turuncu
    return '#ef4444'; // Kırmızı (düşük)
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || 'Heatmap Grafik'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'value') {
                    return [`${value.toFixed(2)} TL`, 'Değer'];
                  }
                  return [value, name];
                }}
              />
              <Bar dataKey="value" name="Değer">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Düşük</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Orta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Yüksek</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



