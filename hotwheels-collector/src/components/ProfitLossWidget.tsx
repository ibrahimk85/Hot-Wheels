'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import type { ProfitLossSummary } from '@/features/analytics/profit.service';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ProfitLossWidgetProps {
  summary: ProfitLossSummary;
}

export function ProfitLossWidget({ summary }: ProfitLossWidgetProps) {
  const isPositive = summary.totalProfit >= 0;
  const isPackedPositive = summary.packedProfit >= 0;
  const isLoosePositive = summary.looseProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Genel Kâr/Zarar Özeti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Toplam Yatırım</div>
              <div className="text-2xl font-bold">{formatPrice(summary.totalInvestment)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Mevcut Değer</div>
              <div className="text-2xl font-bold">{formatPrice(summary.totalCurrentValue)}</div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Net Kâr/Zarar</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {isPositive ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {formatPrice(Math.abs(summary.totalProfit))}
              </div>
            </div>
            <div className={`text-sm flex items-center gap-1 ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              ROI: {summary.totalROI.toFixed(2)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Packed vs Loose Breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Packed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">Yatırım</div>
            <div className="text-lg font-semibold">{formatPrice(summary.packedInvestment)}</div>
            <div className="text-xs text-muted-foreground">Mevcut Değer</div>
            <div className="text-lg font-semibold">{formatPrice(summary.packedCurrentValue)}</div>
            <div className={`text-sm font-medium pt-2 flex items-center gap-1 ${
              isPackedPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPackedPositive ? '+' : ''}
              {formatPrice(summary.packedProfit)} ({summary.packedROI.toFixed(2)}%)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Loose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">Yatırım</div>
            <div className="text-lg font-semibold">{formatPrice(summary.looseInvestment)}</div>
            <div className="text-xs text-muted-foreground">Mevcut Değer</div>
            <div className="text-lg font-semibold">{formatPrice(summary.looseCurrentValue)}</div>
            <div className={`text-sm font-medium pt-2 flex items-center gap-1 ${
              isLoosePositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isLoosePositive ? '+' : ''}
              {formatPrice(summary.looseProfit)} ({summary.looseROI.toFixed(2)}%)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}







