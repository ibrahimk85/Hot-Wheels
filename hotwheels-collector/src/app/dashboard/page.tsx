'use client';

import { useEffect, useState } from 'react';
import { DraggableDashboard } from '@/components/dashboard/DraggableDashboard';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardWidget } from '@/types/dashboard';

export default function CustomizableDashboardPage() {
  const [layout, setLayout] = useState<{
    id: number;
    widgets: DashboardWidget[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/layout?default=true')
      .then((res) => res.json())
      .then((data) => {
        setLayout({
          id: data.id,
          widgets: data.widgets || [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleWidgetsChange = async (widgets: DashboardWidget[]) => {
    setLayout((prev) => (prev ? { ...prev, widgets } : null));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!layout) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Dashboard yüklenemedi. Lütfen sayfayı yenileyin.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DraggableDashboard
      layoutId={layout.id}
      widgets={layout.widgets}
      onWidgetsChange={handleWidgetsChange}
    />
  );
}

