'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import type {
  BuyRecommendation,
  SellRecommendation,
} from '@/features/analytics/investment.service';
import { ShoppingCart, DollarSign, ArrowRight } from 'lucide-react';

interface BuySellRecommendationsWidgetProps {
  buyRecommendations: BuyRecommendation[];
  sellRecommendations: SellRecommendation[];
}

export function BuySellRecommendationsWidget({
  buyRecommendations,
  sellRecommendations,
}: BuySellRecommendationsWidgetProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Buy Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Alış Önerileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          {buyRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Alış önerisi bulunamadı
            </p>
          ) : (
            <div className="space-y-3">
              {buyRecommendations.slice(0, 5).map((item, index) => (
                <div
                  key={`buy-${item.id}-${index}`}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.collectionName}
                          {item.year && ` • ${item.year}`}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {item.reason}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-600">
                      {formatPrice(item.currentMarketPrice)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ortalama: {formatPrice(item.averagePurchasePrice)}
                    </div>
                    <div className="text-xs text-green-600 font-medium">
                      %{item.discountPercentage.toFixed(1)} indirim
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sell Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Satış Önerileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Satış önerisi bulunamadı
            </p>
          ) : (
            <div className="space-y-3">
              {sellRecommendations.slice(0, 5).map((item, index) => (
                <div
                  key={`sell-${item.id}-${index}`}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.collectionName}
                          {item.year && ` • ${item.year}`}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {item.reason}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      +{formatPrice(item.profit)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ROI: {item.roi.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {formatPrice(item.purchasePrice)}
                      <ArrowRight className="h-3 w-3" />
                      {formatPrice(item.currentMarketPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}







