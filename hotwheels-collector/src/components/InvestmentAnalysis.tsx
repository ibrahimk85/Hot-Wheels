'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Award,
  AlertCircle,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface InvestmentAnalysis {
  totalInvestment: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
  roi: number;
  bestInvestment: {
    id: number;
    name: string;
    purchasePrice: number;
    currentPrice: number;
    profit: number;
    profitPercent: number;
  } | null;
  worstInvestment: {
    id: number;
    name: string;
    purchasePrice: number;
    currentPrice: number;
    profit: number;
    profitPercent: number;
  } | null;
  investmentsByCategory: Array<{
    category: string;
    totalInvestment: number;
    currentValue: number;
    profit: number;
    profitPercent: number;
  }>;
}

export function InvestmentAnalysis() {
  const [analysis, setAnalysis] = useState<InvestmentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch('/api/analytics/investment');
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error fetching investment analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Yatırım analizi yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Yatırım analizi bulunamadı
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Yatırım Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Toplam Yatırım</div>
              <div className="text-xl font-bold">
                {analysis.totalInvestment.toFixed(2)} TL
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Güncel Değer</div>
              <div className="text-xl font-bold">
                {analysis.currentValue.toFixed(2)} TL
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Kar/Zarar</div>
              <div
                className={`text-xl font-bold ${
                  analysis.profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {analysis.profit >= 0 ? '+' : ''}
                {analysis.profit.toFixed(2)} TL
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">ROI</div>
              <div
                className={`text-xl font-bold flex items-center gap-1 ${
                  analysis.roi >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {analysis.roi >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {analysis.roi >= 0 ? '+' : ''}
                {analysis.roi.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {analysis.bestInvestment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-600" />
                En İyi Yatırım
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-semibold">{analysis.bestInvestment.name}</div>
                <div className="text-sm space-y-1">
                  <div>
                    Alış: {analysis.bestInvestment.purchasePrice.toFixed(2)} TL
                  </div>
                  <div>
                    Güncel: {analysis.bestInvestment.currentPrice.toFixed(2)} TL
                  </div>
                  <div className="text-green-600 font-semibold">
                    Kar: +{analysis.bestInvestment.profit.toFixed(2)} TL (
                    +{analysis.bestInvestment.profitPercent.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.worstInvestment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                En Kötü Yatırım
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-semibold">{analysis.worstInvestment.name}</div>
                <div className="text-sm space-y-1">
                  <div>
                    Alış: {analysis.worstInvestment.purchasePrice.toFixed(2)} TL
                  </div>
                  <div>
                    Güncel: {analysis.worstInvestment.currentPrice.toFixed(2)} TL
                  </div>
                  <div
                    className={`font-semibold ${
                      analysis.worstInvestment.profit >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {analysis.worstInvestment.profit >= 0 ? 'Kar' : 'Zarar'}:{' '}
                    {analysis.worstInvestment.profit >= 0 ? '+' : ''}
                    {analysis.worstInvestment.profit.toFixed(2)} TL (
                    {analysis.worstInvestment.profitPercent >= 0 ? '+' : ''}
                    {analysis.worstInvestment.profitPercent.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {analysis.investmentsByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kategoriye Göre Yatırım Analizi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.investmentsByCategory.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cat.category}</span>
                    <span
                      className={`text-sm font-semibold ${
                        cat.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {cat.profit >= 0 ? '+' : ''}
                      {cat.profit.toFixed(2)} TL ({cat.profitPercent >= 0 ? '+' : ''}
                      {cat.profitPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Yatırım: {cat.totalInvestment.toFixed(2)} TL → Güncel:{' '}
                      {cat.currentValue.toFixed(2)} TL
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



