'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';

interface Collection {
  id: number;
  name: string;
  year: {
    year: number;
  };
}

interface ExcelExportButtonProps {
  collections?: Collection[];
}

export function ExcelExportButton({ collections = [] }: ExcelExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [owned, setOwned] = useState<'all' | 'true' | 'false'>('all');
  const [year, setYear] = useState<string>('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Yıl değiştiğinde seçili koleksiyon'ı sıfırla (yanlış yıldan olabilir)
  useEffect(() => {
    if (year) {
      setCollectionId('');
    }
  }, [year]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reports/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owned: owned === 'all' ? 'all' : owned === 'true',
          year: year ? Number(year) : undefined,
          collectionId: collectionId ? Number(collectionId) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotwheels-export-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setOpen(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Excel export sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Excel Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excel Export</DialogTitle>
          <DialogDescription>
            Export için filtreleri seçin. Export dosyası Toy#, Col#, Model Ismi,
            Series, Series# ve Photo Thumbnail kolonlarını içerecektir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Sahiplik Durumu</Label>
            <Select value={owned} onValueChange={(value: 'all' | 'true' | 'false') => setOwned(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="true">Sahip Olunan</SelectItem>
                <SelectItem value="false">Sahip Olunmayan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Yıl (Opsiyonel)</Label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            />
          </div>

          {collections.length > 0 && (
            <div className="space-y-2">
              <Label>Koleksiyon (Opsiyonel)</Label>
              <Select
                value={collectionId || 'all'}
                onValueChange={(value) =>
                  setCollectionId(value === 'all' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tüm koleksiyonlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm koleksiyonlar</SelectItem>
                  {(year
                    ? collections.filter((c) => c.year.year === Number(year))
                    : collections
                  ).map((collection) => (
                    <SelectItem
                      key={collection.id}
                      value={collection.id.toString()}
                    >
                      {collection.name} ({collection.year.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Export ediliyor...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Et
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

