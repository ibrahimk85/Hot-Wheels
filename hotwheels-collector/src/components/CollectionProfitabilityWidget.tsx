'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import { Progress } from '@/components/ui/progress';
import type { CollectionProfitability } from '@/features/analytics/profit.service';
import { BarChart3 } from 'lucide-react';

interface CollectionProfitabilityWidgetProps {
  collections: CollectionProfitability[];
  title?: string;
}

export function CollectionProfitabilityWidget({
  collections,
  title = 'Koleksiyon Bazında Kârlılık',
}: CollectionProfitabilityWidgetProps) {
  if (collections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Koleksiyon verisi bulunamadı
          </p>
        </CardContent>
      </Card>
    );
  }

  // Find max ROI for progress bar scaling
  const maxROI = Math.max(...collections.map(c => Math.abs(c.roi)), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {collections.slice(0, 10).map((collection, index) => {
            const isPositive = collection.roi >= 0;
            const progressValue = (Math.abs(collection.roi) / maxROI) * 100;

            return (
              <div key={collection.collectionName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-semibold">{collection.collectionName}</span>
                  </div>
                  <div className={`text-sm font-bold ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? '+' : ''}{collection.roi.toFixed(2)}%
                  </div>
                </div>
                <Progress
                  value={progressValue}
                  className={`h-2 ${
                    isPositive ? 'bg-green-100' : 'bg-red-100'
                  }`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Yatırım: {formatPrice(collection.totalInvestment)}
                  </span>
                  <span>
                    Değer: {formatPrice(collection.totalCurrentValue)}
                  </span>
                  <span>
                    Kâr: {formatPrice(collection.totalProfit)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {collection.itemCount} öğe
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}







