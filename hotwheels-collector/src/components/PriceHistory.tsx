'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface PriceHistoryEntry {
  id: number;
  price: number;
  currency: string;
  source: string;
  url: string | null;
  recordedAt: Date;
}

interface PriceHistoryProps {
  history: PriceHistoryEntry[];
  currentPrice?: number;
}

export function PriceHistory({ history, currentPrice }: PriceHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fiyat Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Henüz fiyat geçmişi kaydı yok.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getPriceChange = (index: number) => {
    if (index === history.length - 1) return null;
    const current = history[index].price;
    const previous = history[index + 1].price;
    const change = current - previous;
    const percentChange = ((change / previous) * 100).toFixed(1);

    if (change > 0) {
      return { type: 'up', value: change, percent: percentChange };
    } else if (change < 0) {
      return { type: 'down', value: Math.abs(change), percent: percentChange };
    }
    return { type: 'same', value: 0, percent: '0' };
  };

  const sourceColors: Record<string, string> = {
    ebay: 'bg-blue-100 text-blue-700',
    manual: 'bg-gray-100 text-gray-700',
    wiki: 'bg-green-100 text-green-700',
    google: 'bg-purple-100 text-purple-700',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyat Geçmişi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((entry, index) => {
            const change = getPriceChange(index);
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {entry.price.toFixed(2)} {entry.currency}
                    </span>
                    {change && (
                      <div className="flex items-center gap-1 text-xs">
                        {change.type === 'up' && (
                          <>
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            <span className="text-green-600">
                              +{change.value.toFixed(2)} ({change.percent}%)
                            </span>
                          </>
                        )}
                        {change.type === 'down' && (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-600" />
                            <span className="text-red-600">
                              -{change.value.toFixed(2)} ({change.percent}%)
                            </span>
                          </>
                        )}
                        {change.type === 'same' && (
                          <>
                            <Minus className="h-3 w-3 text-gray-600" />
                            <span className="text-gray-600">Değişmedi</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        sourceColors[entry.source] || 'bg-gray-100 text-gray-700'
                      }
                    >
                      {entry.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.recordedAt), 'dd MMM yyyy HH:mm')}
                    </span>
                  </div>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                    >
                      Kaynağı görüntüle →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

