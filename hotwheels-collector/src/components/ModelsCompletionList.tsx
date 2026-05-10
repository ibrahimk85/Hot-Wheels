'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { SubSeriesCompletionSummaryItem } from '@/features/models/model.service';

interface ModelsCompletionListProps {
  title: string;
  items: SubSeriesCompletionSummaryItem[];
  emptyText: string;
}

function normalizeImagePath(path: string): string {
  let normalizedPath = path.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  return normalizedPath.replace(/\/+/g, '/');
}

export function ModelsCompletionList({ title, items, emptyText }: ModelsCompletionListProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">{emptyText}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isCompleted = item.isCompleted;
            const detailHref = `/models/completion/${item.subSeriesId}?year=${item.year}`;

            return (
              <Link key={item.groupKey} href={detailHref}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((index) => {
                        const image = item.previewImages[index];
                        return (
                          <div key={`${item.groupKey}-img-${index}`} className="relative h-24 overflow-hidden rounded-md bg-muted">
                            {image ? (
                              <Image
                                src={normalizeImagePath(image.path)}
                                alt={image.alt ?? item.subSeriesName}
                                fill
                                sizes="(max-width: 1024px) 30vw, 15vw"
                                className="object-contain"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Gorsel yok</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">{item.subSeriesName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.collectionName} • {item.year}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {item.packedOwnedModels}/{item.totalModels} Model Packed
                        </span>
                        <Badge variant={isCompleted ? 'default' : 'secondary'}>
                          {isCompleted ? 'Tamamlandi' : `Eksik ${item.missingVariants}`}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Varyant: {item.packedOwnedVariants}/{item.totalVariants}
                      </div>
                      <Progress value={item.modelCompletionPercentage} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

