'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PriceAlertsSummary } from '@/features/analytics/price-trend.service';
import { Bell, CheckCircle, AlertCircle } from 'lucide-react';

interface PriceAlertsWidgetProps {
  summary: PriceAlertsSummary;
}

export function PriceAlertsWidget({ summary }: PriceAlertsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Fiyat Uyarıları Özeti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Aktif Uyarılar</div>
            <div className="text-2xl font-bold">{summary.totalActiveAlerts}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Tetiklenenler
            </div>
            <div className="text-2xl font-bold text-green-600">
              {summary.triggeredAlerts}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Hedefe Yakın
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {summary.nearTargetAlerts}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-2">Uyarı Türleri</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="text-xs">
              <span className="text-muted-foreground">Altında:</span>
              <span className="ml-2 font-semibold">{summary.alertsByCondition.below}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Üstünde:</span>
              <span className="ml-2 font-semibold">{summary.alertsByCondition.above}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Eşit:</span>
              <span className="ml-2 font-semibold">{summary.alertsByCondition.equal}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}







