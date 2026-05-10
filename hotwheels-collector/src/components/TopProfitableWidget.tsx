'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/currency';
import type { ProfitLossItem } from '@/features/analytics/profit.service';
import { TrendingUp, Award } from 'lucide-react';

interface TopProfitableWidgetProps {
  items: ProfitLossItem[];
  title?: string;
}

export function TopProfitableWidget({ items, title = 'En Kârlı Yatırımlar' }: TopProfitableWidgetProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Kâr bilgisi olan öğe bulunamadı
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.id}-${item.type}-${index}`}
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
                      {item.color && ` • ${item.color}`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-600">
                  +{formatPrice(item.profit)}
                </div>
                <div className="text-xs text-muted-foreground">
                  ROI: {item.roi.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Qty: {item.quantity}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}







