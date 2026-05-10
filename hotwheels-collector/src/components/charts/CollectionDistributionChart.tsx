'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CollectionDistributionChartProps {
  data: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#8dd1e1',
  '#d084d0',
];

export function CollectionDistributionChart({
  data,
}: CollectionDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string, props: any) => {
            const percentage = props.payload?.percentage || 0;
            return [
              `${value} varyant (${percentage.toFixed(1)}%)`,
              name,
            ];
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={80}
          formatter={(value: string, entry: any) => {
            const percentage = entry.payload?.percentage || 0;
            return `${value} (${percentage.toFixed(1)}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

