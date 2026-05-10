'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bell, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PriceAlert {
  id: number;
  userId: number | null;
  variantId: number | null;
  modelId: number | null;
  targetPrice: number;
  condition: 'below' | 'above' | 'equal';
  active: boolean;
  notified: boolean;
  createdAt: Date;
  triggeredAt: Date | null;
}

interface PriceAlertDialogProps {
  variantId?: number;
  modelId?: number;
  userId?: number;
  onAlertCreated?: () => void;
}

export function PriceAlertDialog({
  variantId,
  modelId,
  userId,
  onAlertCreated,
}: PriceAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'below' | 'above' | 'equal'>('below');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(userId);

  useEffect(() => {
    // userId prop'u yoksa localStorage'dan al
    if (!currentUserId) {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        setCurrentUserId(parseInt(storedUserId));
      }
    }
  }, []);

  useEffect(() => {
    if (open && currentUserId) {
      fetchAlerts();
    }
  }, [open, currentUserId]);

  const fetchAlerts = async () => {
    if (!currentUserId) return;

    try {
      const response = await fetch(`/api/pricing/alerts?userId=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter(
          (a: PriceAlert) =>
            (variantId && a.variantId === variantId) ||
            (modelId && a.modelId === modelId)
        );
        setAlerts(filtered);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const handleCreate = async () => {
    if (!targetPrice || !currentUserId) {
      setError('Fiyat gerekli');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pricing/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          variantId,
          modelId,
          targetPrice: parseFloat(targetPrice),
          condition,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Uyarı oluşturulamadı');
      }

      await fetchAlerts();
      setTargetPrice('');
      setCondition('below');
      if (onAlertCreated) {
        onAlertCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    try {
      const response = await fetch(`/api/pricing/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchAlerts();
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Fiyat Uyarısı
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fiyat Uyarıları</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Hedef Fiyat (TL)</Label>
              <Input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Koşul</Label>
              <Select
                value={condition}
                onValueChange={(value: 'below' | 'above' | 'equal') =>
                  setCondition(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below">Fiyat düştüğünde (Altında)</SelectItem>
                  <SelectItem value="above">Fiyat yükseldiğinde (Üstünde)</SelectItem>
                  <SelectItem value="equal">Fiyat eşit olduğunda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <Button onClick={handleCreate} disabled={loading} className="w-full">
              {loading ? 'Oluşturuluyor...' : 'Uyarı Oluştur'}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Aktif Uyarılar</h3>
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Henüz uyarı yok
              </div>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {alert.condition === 'below' && 'Fiyat'}
                            {alert.condition === 'below' && ' ≤ '}
                            {alert.condition === 'above' && 'Fiyat'}
                            {alert.condition === 'above' && ' ≥ '}
                            {alert.condition === 'equal' && 'Fiyat'}
                            {alert.condition === 'equal' && ' = '}
                            {alert.targetPrice.toFixed(2)} TL
                          </span>
                          {alert.notified && (
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                              Tetiklendi
                            </span>
                          )}
                          {!alert.active && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">
                              Pasif
                            </span>
                          )}
                        </div>
                        {alert.triggeredAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(alert.triggeredAt).toLocaleDateString('tr-TR')}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(alert.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

