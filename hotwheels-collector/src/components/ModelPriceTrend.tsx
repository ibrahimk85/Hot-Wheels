'use client';

import { useState, useEffect } from 'react';
import { PriceTrendChart } from './PriceTrendChart';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModelPriceTrendProps {
  modelId: number;
}

export function ModelPriceTrend({ modelId }: ModelPriceTrendProps) {
  const [trends, setTrends] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchTrends();
    fetchAnalysis();
  }, [modelId, days]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pricing/trend?modelId=${modelId}&days=${days}`
      );
      if (response.ok) {
        const data = await response.json();
        setTrends(data);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const response = await fetch(
        `/api/pricing/trend?modelId=${modelId}&days=${days}&type=analysis`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Fiyat trendi yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fiyat Trendi</h3>
        <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 Gün</SelectItem>
            <SelectItem value="30">30 Gün</SelectItem>
            <SelectItem value="90">90 Gün</SelectItem>
            <SelectItem value="180">180 Gün</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PriceTrendChart trends={trends} analysis={analysis} />
    </div>
  );
}



