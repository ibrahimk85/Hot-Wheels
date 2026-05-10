'use client';

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

interface YearDistributionChartProps {
  data: Array<{
    year: number;
    count: number;
    ownedCount: number;
  }>;
}

export function YearDistributionChart({
  data,
}: YearDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value} varyant`,
            name === 'count' ? 'Toplam' : 'Sahip Olunan',
          ]}
        />
        <Legend />
        <Bar dataKey="count" fill="#8884d8" name="Toplam" />
        <Bar dataKey="ownedCount" fill="#82ca9d" name="Sahip Olunan" />
      </BarChart>
    </ResponsiveContainer>
  );
}




