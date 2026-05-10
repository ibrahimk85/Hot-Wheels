'use client';

import { useState, useEffect } from 'react';
import { PricePredictionChart } from './PricePredictionChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PricePrediction {
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: '1month' | '3months' | '6months' | '1year';
  factors: string[];
}

interface ModelPricePredictionProps {
  modelId: number;
  modelName: string;
}

export function ModelPricePrediction({ modelId, modelName }: ModelPricePredictionProps) {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'1month' | '3months' | '6months' | '1year'>('3months');

  const fetchPrediction = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/predict-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId, timeframe }),
      });

      if (response.ok) {
        const data = await response.json();
        setPrediction(data);
      }
    } catch (error) {
      console.error('Error fetching price prediction:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [modelId, timeframe]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Fiyat tahmini hesaplanıyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>Fiyat tahmini için yeterli veri bulunamadı.</p>
            <p className="text-xs mt-2">
              Model için fiyat geçmişi ekleyerek tahmin alabilirsiniz.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Fiyat Tahmini
        </h3>
        <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1month">1 Ay</SelectItem>
            <SelectItem value="3months">3 Ay</SelectItem>
            <SelectItem value="6months">6 Ay</SelectItem>
            <SelectItem value="1year">1 Yıl</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PricePredictionChart prediction={prediction} modelName={modelName} />
    </div>
  );
}




