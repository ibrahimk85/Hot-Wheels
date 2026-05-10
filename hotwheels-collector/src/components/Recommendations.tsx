'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Sparkles, TrendingUp, Target, Package } from 'lucide-react';

interface SimilarModel {
  id: number;
  castingName: string;
  castingId: string | null;
  subSeries: {
    name: string;
    collection: {
      name: string;
      year: {
        year: number;
      };
    };
  } | null;
  variants: Array<{
    id: number;
    year: number;
    color: string | null;
    images: Array<{ path: string }>;
  }>;
  similarityScore: number;
}

interface MissingModel {
  id: number;
  castingName: string;
  castingId: string | null;
  subSeries: {
    name: string;
    collection: {
      name: string;
      year: {
        year: number;
      };
    };
  } | null;
  variants: Array<{
    id: number;
    year: number;
    color: string | null;
    images: Array<{ path: string }>;
  }>;
}

interface CompletionSuggestion {
  subSeriesId: number;
  subSeriesName: string;
  collectionName: string;
  year: number;
  totalModels: number;
  ownedModels: number;
  missingModels: number;
  completionPercentage: number;
  missingModelList: MissingModel[];
}

interface RecommendationsProps {
  modelId?: number;
  subSeriesId?: number;
  collectionId?: number;
}

export function Recommendations({
  modelId,
  subSeriesId,
  collectionId,
}: RecommendationsProps) {
  const [similarModels, setSimilarModels] = useState<SimilarModel[]>([]);
  const [missingModels, setMissingModels] = useState<MissingModel[]>([]);
  const [completionSuggestions, setCompletionSuggestions] = useState<
    CompletionSuggestion[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecommendations() {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [];

        if (modelId) {
          promises.push(
            fetch(`/api/recommendations/similar?modelId=${modelId}`).then((r) =>
              r.json()
            )
          );
        }

        if (subSeriesId) {
          promises.push(
            fetch(`/api/recommendations/missing?subSeriesId=${subSeriesId}`).then(
              (r) => r.json()
            )
          );
        }

        if (collectionId) {
          promises.push(
            fetch(
              `/api/recommendations/missing?collectionId=${collectionId}`
            ).then((r) => r.json())
          );
        }

        promises.push(
          fetch('/api/recommendations/completion').then((r) => r.json())
        );

        const results = await Promise.all(promises);

        let resultIndex = 0;
        if (modelId) {
          setSimilarModels(results[resultIndex++] || []);
        }
        if (subSeriesId || collectionId) {
          setMissingModels(results[resultIndex++] || []);
        }
        setCompletionSuggestions(
          results[results.length - 1] || []
        );
      } catch (error) {
        console.error('Error loading recommendations:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [modelId, subSeriesId, collectionId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Öneriler yükleniyor...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-semibold">Akıllı Öneriler</h2>
      </div>

      <Tabs defaultValue="completion" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="completion">
            <Target className="h-4 w-4 mr-2" />
            Tamamlanma
          </TabsTrigger>
          {modelId && (
            <TabsTrigger value="similar">
              <TrendingUp className="h-4 w-4 mr-2" />
              Benzer Modeller
            </TabsTrigger>
          )}
          {(subSeriesId || collectionId) && (
            <TabsTrigger value="missing">
              <Package className="h-4 w-4 mr-2" />
              Eksik Modeller
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="completion" className="space-y-4">
          {completionSuggestions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Tamamlanmaya yakın seri bulunamadı.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completionSuggestions.map((suggestion) => (
                <Card key={suggestion.subSeriesId}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {suggestion.subSeriesName}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {suggestion.collectionName} • {suggestion.year}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          İlerleme
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {suggestion.ownedModels} / {suggestion.totalModels} (
                          {suggestion.completionPercentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress
                        value={suggestion.completionPercentage}
                        className="h-2"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {suggestion.missingModels} model eksik
                    </div>
                    {suggestion.missingModelList.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium mb-2">
                          Eksik Modeller:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.missingModelList
                            .slice(0, 5)
                            .map((model) => (
                              <Link
                                key={model.id}
                                href={`/model/${model.id}`}
                                className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                              >
                                {model.castingName}
                              </Link>
                            ))}
                          {suggestion.missingModelList.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{suggestion.missingModelList.length - 5} daha
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {modelId && (
          <TabsContent value="similar" className="space-y-4">
            {similarModels.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Benzer model bulunamadı.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {similarModels.map((model) => {
                  const img = model.variants[0]?.images[0];
                  return (
                    <Card
                      key={model.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <Link href={`/model/${model.id}`}>
                        <CardContent className="p-4 flex flex-col gap-2">
                          {img?.path ? (
                            <div className="relative w-full h-32 rounded-md overflow-hidden bg-transparent">
                              <Image
                                src={(() => {
                                  let normalizedPath = img.path.replace(
                                    /\\/g,
                                    '/'
                                  );
                                  if (!normalizedPath.startsWith('/')) {
                                    normalizedPath = '/' + normalizedPath;
                                  }
                                  normalizedPath = normalizedPath.replace(
                                    /\/+/g,
                                    '/'
                                  );
                                  return normalizedPath;
                                })()}
                                alt={model.castingName}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                              Görsel yok
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="font-semibold text-sm">
                              {model.castingName}
                            </div>
                            {model.subSeries && (
                              <div className="text-xs text-muted-foreground">
                                {model.subSeries.collection.year.year} •{' '}
                                {model.subSeries.collection.name}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Benzerlik: {model.similarityScore}%
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {(subSeriesId || collectionId) && (
          <TabsContent value="missing" className="space-y-4">
            {missingModels.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Eksik model bulunamadı.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {missingModels.map((model) => {
                  const img = model.variants[0]?.images[0];
                  return (
                    <Card
                      key={model.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <Link href={`/model/${model.id}`}>
                        <CardContent className="p-4 flex flex-col gap-2">
                          {img?.path ? (
                            <div className="relative w-full h-32 rounded-md overflow-hidden bg-transparent">
                              <Image
                                src={(() => {
                                  let normalizedPath = img.path.replace(
                                    /\\/g,
                                    '/'
                                  );
                                  if (!normalizedPath.startsWith('/')) {
                                    normalizedPath = '/' + normalizedPath;
                                  }
                                  normalizedPath = normalizedPath.replace(
                                    /\/+/g,
                                    '/'
                                  );
                                  return normalizedPath;
                                })()}
                                alt={model.castingName}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                              Görsel yok
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="font-semibold text-sm">
                              {model.castingName}
                            </div>
                            {model.subSeries && (
                              <div className="text-xs text-muted-foreground">
                                {model.subSeries.collection.year.year} •{' '}
                                {model.subSeries.collection.name}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}




