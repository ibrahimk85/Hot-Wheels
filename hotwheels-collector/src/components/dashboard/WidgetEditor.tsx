'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { DashboardWidget, DashboardWidgetInput } from '@/types/dashboard';

interface WidgetEditorProps {
  layoutId: number;
  widget?: DashboardWidget;
  onSave: (widget: DashboardWidget) => void;
}

export function WidgetEditor({ layoutId, widget, onSave }: WidgetEditorProps) {
  const [type, setType] = useState(widget?.type || 'stats');
  const [size, setSize] = useState(widget?.size || '1x1');
  const [config, setConfig] = useState<Record<string, any>>(widget?.config || {});

  const handleSave = async () => {
    const widgetData: DashboardWidgetInput = {
      id: widget?.id,
      type,
      position: widget?.position || 0,
      size,
      config,
    };

    try {
      if (widget?.id) {
        // Güncelle
        const response = await fetch(`/api/dashboard/widgets/${widget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(widgetData),
        });
        if (response.ok) {
          const updated = await response.json();
          onSave(updated);
        }
      } else {
        // Yeni widget ekle
        const response = await fetch('/api/dashboard/widgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...widgetData, layoutId }),
        });
        if (response.ok) {
          const created = await response.json();
          onSave(created);
        }
      }
    } catch (error) {
      console.error('Error saving widget:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Widget Tipi</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stats">İstatistikler</SelectItem>
            <SelectItem value="chart">Grafik</SelectItem>
            <SelectItem value="collection">Koleksiyon</SelectItem>
            <SelectItem value="goal">Hedefler</SelectItem>
            <SelectItem value="achievement">Başarımlar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Boyut</Label>
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1x1">1x1 (Küçük)</SelectItem>
            <SelectItem value="2x1">2x1 (Geniş)</SelectItem>
            <SelectItem value="1x2">1x2 (Uzun)</SelectItem>
            <SelectItem value="2x2">2x2 (Büyük)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Başlık</Label>
        <Input
          value={config.title || ''}
          onChange={(e) => setConfig({ ...config, title: e.target.value })}
          placeholder="Widget başlığı"
        />
      </div>

      {type === 'stats' && (
        <div className="space-y-2">
          <Label>Gösterilecek İstatistikler</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showTotalModels"
                checked={config.showTotalModels !== false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, showTotalModels: checked })
                }
              />
              <Label htmlFor="showTotalModels">Toplam Model</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showTotalVariants"
                checked={config.showTotalVariants !== false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, showTotalVariants: checked })
                }
              />
              <Label htmlFor="showTotalVariants">Toplam Varyant</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showOwnedVariants"
                checked={config.showOwnedVariants !== false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, showOwnedVariants: checked })
                }
              />
              <Label htmlFor="showOwnedVariants">Sahip Olunan</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showCollectionValue"
                checked={config.showCollectionValue !== false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, showCollectionValue: checked })
                }
              />
              <Label htmlFor="showCollectionValue">Koleksiyon Değeri</Label>
            </div>
          </div>
        </div>
      )}

      {type === 'chart' && (
        <div className="space-y-2">
          <Label>Grafik Tipi</Label>
          <Select
            value={config.chartType || 'pie'}
            onValueChange={(value) => setConfig({ ...config, chartType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pie">Pasta Grafiği</SelectItem>
              <SelectItem value="bar">Çubuk Grafik</SelectItem>
              <SelectItem value="line">Çizgi Grafik</SelectItem>
            </SelectContent>
          </Select>
          <Label>Veri Kaynağı</Label>
          <Select
            value={config.dataSource || 'collection'}
            onValueChange={(value) => setConfig({ ...config, dataSource: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collection">Koleksiyon</SelectItem>
              <SelectItem value="year">Yıl</SelectItem>
              <SelectItem value="series">Seri</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {type === 'collection' && (
        <div className="space-y-2">
          <Label>Gösterim Tipi</Label>
          <Select
            value={config.type || 'recent'}
            onValueChange={(value) => setConfig({ ...config, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Son Eklenenler</SelectItem>
              <SelectItem value="valuable">Değerli Modeller</SelectItem>
              <SelectItem value="missing">Eksik Modeller</SelectItem>
            </SelectContent>
          </Select>
          <Label>Limit</Label>
          <Input
            type="number"
            value={config.limit || 5}
            onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) || 5 })}
            min={1}
            max={20}
          />
        </div>
      )}

      {type === 'goal' && (
        <div className="space-y-2">
          <Label>Limit</Label>
          <Input
            type="number"
            value={config.limit || 3}
            onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) || 3 })}
            min={1}
            max={10}
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showCompleted"
              checked={config.showCompleted !== false}
              onCheckedChange={(checked) => setConfig({ ...config, showCompleted: checked })}
            />
            <Label htmlFor="showCompleted">Tamamlananları Göster</Label>
          </div>
        </div>
      )}

      {type === 'achievement' && (
        <div className="space-y-2">
          <Label>Limit</Label>
          <Input
            type="number"
            value={config.limit || 5}
            onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) || 5 })}
            min={1}
            max={20}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave}>Kaydet</Button>
      </div>
    </div>
  );
}

