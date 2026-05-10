'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Grid, List, ZoomIn, ZoomOut } from 'lucide-react';

interface Variant {
  id: number;
  year: number;
  color: string | null;
  releaseName: string | null;
  cardNumber: string | null;
  isTreasureHunt: boolean;
  isSuperTreasureHunt: boolean;
  images: Array<{
    path: string;
    alt: string | null;
  }>;
}

interface VariantComparisonProps {
  variants: Variant[];
  modelName: string;
}

export function VariantComparison({ variants, modelName }: VariantComparisonProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (variants.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Karşılaştırılacak varyant bulunamadı
      </div>
    );
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Tüm Varyantları Karşılaştır ({variants.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelName} - Varyant Karşılaştırması</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom}>
                Reset
              </Button>
            </div>
          </div>

          {/* Variants Display */}
          {viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {variants.map((variant) => {
                const img = variant.images?.[0];
                return (
                  <Card
                    key={variant.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      selectedVariant === variant.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedVariant(variant.id)}
                  >
                    <CardContent className="p-4">
                      {img?.path ? (
                        <div
                          className="relative w-full rounded-md overflow-hidden bg-muted"
                          style={{
                            height: `${200 * zoomLevel}px`,
                            transition: 'height 0.2s',
                          }}
                        >
                          <Image
                            src={(() => {
                              let normalizedPath = img.path.replace(/\\/g, '/');
                              if (!normalizedPath.startsWith('/')) {
                                normalizedPath = '/' + normalizedPath;
                              }
                              normalizedPath = normalizedPath.replace(/\/+/g, '/');
                              return normalizedPath;
                            })()}
                            alt={img.alt || modelName}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          className="w-full flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground"
                          style={{
                            height: `${200 * zoomLevel}px`,
                            transition: 'height 0.2s',
                          }}
                        >
                          Görsel yok
                        </div>
                      )}
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="font-semibold">
                          {variant.year} • #{variant.cardNumber || '—'}
                        </div>
                        <div className="text-muted-foreground">
                          {variant.color || variant.releaseName || '—'}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variant.isTreasureHunt && (
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">
                              TH
                            </span>
                          )}
                          {variant.isSuperTreasureHunt && (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-semibold">
                              STH
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {variants.map((variant) => {
                const img = variant.images?.[0];
                return (
                  <Card
                    key={variant.id}
                    className={`hover:shadow-md transition-shadow ${
                      selectedVariant === variant.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedVariant(variant.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {img?.path ? (
                          <div
                            className="relative rounded-md overflow-hidden bg-muted flex-shrink-0"
                            style={{
                              width: `${150 * zoomLevel}px`,
                              height: `${150 * zoomLevel}px`,
                              transition: 'all 0.2s',
                            }}
                          >
                            <Image
                              src={(() => {
                                let normalizedPath = img.path.replace(/\\/g, '/');
                                if (!normalizedPath.startsWith('/')) {
                                  normalizedPath = '/' + normalizedPath;
                                }
                                normalizedPath = normalizedPath.replace(/\/+/g, '/');
                                return normalizedPath;
                              })()}
                              alt={img.alt || modelName}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground flex-shrink-0"
                            style={{
                              width: `${150 * zoomLevel}px`,
                              height: `${150 * zoomLevel}px`,
                              transition: 'all 0.2s',
                            }}
                          >
                            Görsel yok
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <div>
                            <div className="font-semibold">
                              {variant.year} • #{variant.cardNumber || '—'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {variant.color || variant.releaseName || '—'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {variant.isTreasureHunt && (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">
                                TH
                              </span>
                            )}
                            {variant.isSuperTreasureHunt && (
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-semibold">
                                STH
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}




