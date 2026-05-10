'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  CollectionValue,
  TopValuableModel,
  TopValuableVariant,
  ValueTrend,
} from '@/features/analytics/value.service';
import { ValueDistributionChart } from './charts/ValueDistributionChart';

interface ValueAnalysisProps {
  totalValue: {
    totalPackedValue: number;
    totalLooseValue: number;
    totalValue: number;
  };
  collectionValues: CollectionValue[];
  topValuableModels: TopValuableModel[];
  topValuableVariants: TopValuableVariant[];
  valueTrend: ValueTrend[];
}

import { formatPrice } from '@/lib/currency';

function formatCurrency(value: number): string {
  return formatPrice(value);
}

export function ValueAnalysis({
  totalValue,
  collectionValues,
  topValuableModels,
  topValuableVariants,
  valueTrend,
}: ValueAnalysisProps) {
  return (
    <div className="space-y-6">
      {/* Total Value Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Değer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue.totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Packed Değer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue.totalPackedValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Loose Değer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue.totalLooseValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Value Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Koleksiyon Bazında Değer Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <ValueDistributionChart data={collectionValues} />
        </CardContent>
      </Card>

      {/* Top Valuable Models and Variants */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>En Değerli 10 Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topValuableModels.map((model, index) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div>
                        <div className="text-sm font-semibold">
                          {model.castingName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {model.collectionName}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {formatCurrency(model.totalValue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Qty: {model.quantity}
                    </div>
                  </div>
                </div>
              ))}
              {topValuableModels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Fiyat bilgisi olan model bulunamadı
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>En Değerli 10 Varyant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topValuableVariants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div>
                        <div className="text-sm font-semibold">
                          {variant.modelName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {variant.color || 'N/A'} • {variant.year} •{' '}
                          {variant.collectionName}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {formatCurrency(variant.totalValue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Qty: {variant.quantity}
                    </div>
                  </div>
                </div>
              ))}
              {topValuableVariants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Fiyat bilgisi olan varyant bulunamadı
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




