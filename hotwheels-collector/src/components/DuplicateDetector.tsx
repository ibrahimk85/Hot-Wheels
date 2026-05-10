'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, Merge } from 'lucide-react';

interface DuplicateGroup {
  type: 'model' | 'variant';
  entities: Array<{
    id: number;
    name: string;
    details: Record<string, any>;
  }>;
  similarity: number;
  suggestedMerge?: {
    keepId: number;
    mergeIds: number[];
  };
}

export function DuplicateDetector() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean;
    group: DuplicateGroup | null;
  }>({ open: false, group: null });
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    findDuplicates();
  }, []);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const [modelsResponse, variantsResponse] = await Promise.all([
        fetch('/api/data-management/duplicates/models'),
        fetch('/api/data-management/duplicates/variants'),
      ]);

      const models = modelsResponse.ok ? await modelsResponse.json() : [];
      const variants = variantsResponse.ok ? await variantsResponse.json() : [];

      setDuplicates([...models, ...variants]);
    } catch (error) {
      console.error('Duplicate detection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeDialog.group?.suggestedMerge) return;

    setMerging(true);
    try {
      const { keepId, mergeIds } = mergeDialog.group.suggestedMerge;
      const endpoint =
        mergeDialog.group.type === 'model'
          ? '/api/data-management/duplicates/merge-models'
          : '/api/data-management/duplicates/merge-variants';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId, mergeIds }),
      });

      if (response.ok) {
        setMergeDialog({ open: false, group: null });
        findDuplicates(); // Refresh
      }
    } catch (error) {
      console.error('Merge error:', error);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Duplicate Detection</CardTitle>
            <CardDescription>
              Tekrarlanan modelleri ve variant'ları tespit edin ve birleştirin
            </CardDescription>
          </div>
          <Button onClick={findDuplicates} disabled={loading} variant="outline" size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Yenile
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Duplicate'ler aranıyor...</span>
          </div>
        ) : duplicates.length === 0 ? (
          <Alert>
            <AlertDescription>
              Tekrarlanan model veya variant bulunamadı.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group, index) => (
              <Alert key={index}>
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{group.type === 'model' ? 'Model' : 'Variant'}</Badge>
                        <span className="font-semibold">
                          {group.entities.length} duplicate bulundu
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {group.entities.map((entity) => (
                          <div key={entity.id} className="flex items-center gap-2">
                            <span className="font-medium">{entity.name}</span>
                            <span className="text-muted-foreground">
                              (ID: {entity.id})
                            </span>
                            {entity.details.owned && (
                              <Badge variant="secondary" className="text-xs">
                                Sahip
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {group.suggestedMerge && (
                      <Button
                        onClick={() => setMergeDialog({ open: true, group })}
                        size="sm"
                        variant="outline"
                      >
                        <Merge className="h-4 w-4 mr-2" />
                        Birleştir
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={mergeDialog.open} onOpenChange={(open) => setMergeDialog({ open, group: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate'leri Birleştir</DialogTitle>
            <DialogDescription>
              {mergeDialog.group?.suggestedMerge && (
                <>
                  ID {mergeDialog.group.suggestedMerge.keepId} tutulacak, diğerleri birleştirilecek.
                  Bu işlem geri alınamaz.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialog({ open: false, group: null })}
            >
              İptal
            </Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Birleştiriliyor...
                </>
              ) : (
                'Birleştir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}



