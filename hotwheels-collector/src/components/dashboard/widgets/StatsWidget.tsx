'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, Car, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatsWidgetProps {
  config: {
    title?: string;
    showTotalModels?: boolean;
    showTotalVariants?: boolean;
    showOwnedVariants?: boolean;
    showCollectionValue?: boolean;
  };
}

export function StatsWidget({ config }: StatsWidgetProps) {
  const [stats, setStats] = useState({
    totalModels: 0,
    totalVariants: 0,
    ownedVariants: 0,
    collectionValue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title || 'İstatistikler'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title || 'İstatistikler'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {config.showTotalModels !== false && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalModels}</div>
                <div className="text-xs text-muted-foreground">Toplam Model</div>
              </div>
            </div>
          )}
          {config.showTotalVariants !== false && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalVariants}</div>
                <div className="text-xs text-muted-foreground">Toplam Varyant</div>
              </div>
            </div>
          )}
          {config.showOwnedVariants !== false && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.ownedVariants}</div>
                <div className="text-xs text-muted-foreground">Sahip Olunan</div>
              </div>
            </div>
          )}
          {config.showCollectionValue !== false && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.collectionValue.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">Koleksiyon Değeri (TL)</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



