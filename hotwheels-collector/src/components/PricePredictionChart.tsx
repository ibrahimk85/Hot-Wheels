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
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PricePrediction {
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: '1month' | '3months' | '6months' | '1year';
  factors: string[];
}

interface PricePredictionChartProps {
  prediction: PricePrediction;
  modelName: string;
}

export function PricePredictionChart({ prediction, modelName }: PricePredictionChartProps) {
  const timeframeLabels: Record<string, string> = {
    '1month': '1 Ay',
    '3months': '3 Ay',
    '6months': '6 Ay',
    '1year': '1 Yıl',
  };

  // Grafik verisi
  const chartData = [
    {
      name: 'Şimdi',
      fiyat: prediction.currentPrice,
    },
    {
      name: timeframeLabels[prediction.timeframe],
      fiyat: prediction.predictedPrice,
    },
  ];

  const change = prediction.predictedPrice - prediction.currentPrice;
  const changePercent = (change / prediction.currentPrice) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Fiyat Tahmini - {modelName}</span>
          <div className="flex items-center gap-2">
            {prediction.trend === 'increasing' && (
              <TrendingUp className="h-5 w-5 text-green-600" />
            )}
            {prediction.trend === 'decreasing' && (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            {prediction.trend === 'stable' && (
              <Minus className="h-5 w-5 text-gray-600" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Mevcut Fiyat</div>
            <div className="text-2xl font-bold">{prediction.currentPrice.toFixed(2)} TL</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Tahmini Fiyat</div>
            <div className="text-2xl font-bold">{prediction.predictedPrice.toFixed(2)} TL</div>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)} TL`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="fiyat"
                stroke={prediction.trend === 'increasing' ? '#22c55e' : prediction.trend === 'decreasing' ? '#ef4444' : '#6b7280'}
                strokeWidth={2}
                name="Fiyat"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Değişim</span>
            <span
              className={`text-sm font-bold ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)} TL ({changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Güven</span>
            <span className="text-sm">
              {(prediction.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {prediction.factors.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Faktörler</div>
            <ul className="space-y-1">
              {prediction.factors.map((factor, idx) => (
                <li key={idx} className="text-xs text-muted-foreground">
                  • {factor}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




