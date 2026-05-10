'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface TimelineChartData {
  month: string;
  count: number;
  value?: number;
  ownedCount?: number;
}

interface TimelineChartProps {
  data: TimelineChartData[];
  title?: string;
}

export function TimelineChart({ data, title }: TimelineChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || 'Zaman Çizelgesi'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Veri bulunamadı
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || 'Zaman Çizelgesi'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'count') {
                    return [`${value} model`, 'Model Sayısı'];
                  }
                  if (name === 'value') {
                    return [`${value.toFixed(2)} TL`, 'Değer'];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                name="Model Sayısı"
                strokeWidth={2}
              />
              {data.some((d) => d.value !== undefined) && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="value"
                  stroke="#82ca9d"
                  name="Değer (TL)"
                  strokeWidth={2}
                />
              )}
              {data.some((d) => d.ownedCount !== undefined) && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ownedCount"
                  stroke="#ffc658"
                  name="Sahip Olunan"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


