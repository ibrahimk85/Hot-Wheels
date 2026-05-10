'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Target } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface CompletionStats {
  collectionId: number;
  collectionName: string;
  year: number;
  totalModels: number;
  ownedModels: number;
  completionPercent: number;
  missingModels: number;
}

interface OverallCompletion {
  totalCollections: number;
  completedCollections: number;
  averageCompletion: number;
  totalModels: number;
  ownedModels: number;
  overallCompletionPercent: number;
}

export function CompletionRate() {
  const [overall, setOverall] = useState<OverallCompletion | null>(null);
  const [collections, setCollections] = useState<CompletionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompletion();
  }, []);

  const fetchCompletion = async () => {
    try {
      const [overallResponse, collectionsResponse] = await Promise.all([
        fetch('/api/analytics/completion/overall'),
        fetch('/api/analytics/completion/collections'),
      ]);

      if (overallResponse.ok) {
        const overallData = await overallResponse.json();
        setOverall(overallData);
      }

      if (collectionsResponse.ok) {
        const collectionsData = await collectionsResponse.json();
        setCollections(collectionsData);
      }
    } catch (error) {
      console.error('Error fetching completion data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Tamamlanma oranı yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {overall && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Genel Tamamlanma Oranı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Toplam İlerleme</span>
                <span className="text-sm font-bold">
                  {overall.overallCompletionPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={overall.overallCompletionPercent} className="h-3" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Toplam Model</div>
                <div className="text-lg font-bold">{overall.totalModels}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Sahip Olunan</div>
                <div className="text-lg font-bold">{overall.ownedModels}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Eksik</div>
                <div className="text-lg font-bold">
                  {overall.totalModels - overall.ownedModels}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Tamamlanan Koleksiyon</div>
                <div className="text-lg font-bold">
                  {overall.completedCollections} / {overall.totalCollections}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Koleksiyon Bazında Tamamlanma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {collections.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Koleksiyon verisi bulunamadı
              </div>
            ) : (
              collections
                .sort((a, b) => b.completionPercent - a.completionPercent)
                .map((collection) => (
                  <Link
                    key={collection.collectionId}
                    href={`/collections/${collection.collectionName.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="p-4 border rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {collection.collectionName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({collection.year})
                          </span>
                          {collection.completionPercent === 100 && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <span className="text-sm font-bold">
                          {collection.completionPercent.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={collection.completionPercent} className="h-2 mb-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {collection.ownedModels} / {collection.totalModels} model
                        </span>
                        {collection.missingModels > 0 && (
                          <span>{collection.missingModels} eksik</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



