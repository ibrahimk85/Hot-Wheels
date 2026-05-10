'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Clock } from 'lucide-react';

interface CollectionWidgetProps {
  config: {
    title?: string;
    limit?: number;
    type?: 'recent' | 'valuable' | 'missing';
  };
}

interface CollectionItem {
  id: number;
  name: string;
  collectionName?: string;
  year?: number;
  value?: number;
  addedAt?: string;
}

export function CollectionWidget({ config }: CollectionWidgetProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoint = config.type === 'valuable'
      ? '/api/dashboard/collection/valuable'
      : config.type === 'missing'
      ? '/api/dashboard/collection/missing'
      : '/api/dashboard/collection/recent';

    fetch(`${endpoint}?limit=${config.limit || 5}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [config.type, config.limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title || 'Koleksiyon'}</CardTitle>
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
        <CardTitle>{config.title || 'Koleksiyon'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Veri bulunamadı
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/model/${item.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    {item.collectionName && (
                      <div className="text-xs text-muted-foreground">
                        {item.collectionName}
                        {item.year && ` (${item.year})`}
                      </div>
                    )}
                  </div>
                </div>
                {item.value !== undefined && (
                  <div className="text-sm font-semibold text-right ml-2">
                    {item.value.toFixed(0)} TL
                  </div>
                )}
                {item.addedAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                    <Clock className="h-3 w-3" />
                    {new Date(item.addedAt).toLocaleDateString('tr-TR')}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}



