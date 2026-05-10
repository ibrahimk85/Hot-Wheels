'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import type { InvestmentSummary } from '@/features/analytics/investment.service';
import { Wallet, TrendingUp, DollarSign } from 'lucide-react';

interface InvestmentSummaryWidgetProps {
  summary: InvestmentSummary;
}

export function InvestmentSummaryWidget({ summary }: InvestmentSummaryWidgetProps) {
  const isPositive = summary.netProfit >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Yatırım Özeti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Toplam Yatırım
            </div>
            <div className="text-2xl font-bold">{formatPrice(summary.totalInvestment)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Mevcut Değer
            </div>
            <div className="text-2xl font-bold">{formatPrice(summary.totalCurrentValue)}</div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Net Kâr</div>
            <div className={`text-2xl font-bold ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? '+' : ''}{formatPrice(summary.netProfit)}
            </div>
          </div>
          <div className={`text-sm ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            Genel ROI: {summary.overallROI.toFixed(2)}%
          </div>
        </div>

        <div className="pt-4 border-t grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ortalama Alış Fiyatı</div>
            <div className="text-lg font-semibold">
              {formatPrice(summary.averagePurchasePrice)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ortalama Piyasa Fiyatı</div>
            <div className="text-lg font-semibold">
              {formatPrice(summary.averageMarketPrice)}
            </div>
          </div>
        </div>

        <div className="pt-2 text-xs text-muted-foreground">
          Toplam {summary.itemCount} öğe
        </div>
      </CardContent>
    </Card>
  );
}







