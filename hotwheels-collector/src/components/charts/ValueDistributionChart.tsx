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

interface ValueDistributionChartProps {
  data: Array<{
    name: string;
    packedValue: number;
    looseValue: number;
    totalValue: number;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ValueDistributionChart({
  data,
}: ValueDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Fiyat bilgisi olan koleksiyon bulunamadı
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === 'packedValue'
              ? 'Packed'
              : name === 'looseValue'
              ? 'Loose'
              : 'Toplam',
          ]}
        />
        <Legend />
        <Bar dataKey="packedValue" fill="#8884d8" name="Packed" />
        <Bar dataKey="looseValue" fill="#82ca9d" name="Loose" />
      </BarChart>
    </ResponsiveContainer>
  );
}




