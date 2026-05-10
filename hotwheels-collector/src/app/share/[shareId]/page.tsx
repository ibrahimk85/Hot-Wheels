import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getShareLinkByShareId } from '@/features/share/share.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCollectionById } from '@/features/collections/collection.service';
import { getModelById } from '@/features/models/model.service';
import { getVariantById } from '@/features/variants/variant.service';
import {
  collectionUsesVariantLevelPreviewImages,
  getModelCardVariantLevelCandidates,
  pickFirstVariantPreviewAmong,
} from '@/lib/variant-preview-image';
import { WikiAwareHotWheelsImage } from '@/components/WikiAwareHotWheelsImage';

type SharePageProps = {
  params: Promise<{ shareId: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  const shareLink = await getShareLinkByShareId(shareId);

  if (!shareLink) {
    notFound();
  }

  let content: React.ReactNode = null;
  let title = '';

  try {
    switch (shareLink.type) {
      case 'collection': {
        const collection = await getCollectionById(shareLink.targetId);
        if (!collection) {
          notFound();
        }
        title = `${collection.name} Koleksiyonu`;
        const models = collection.models || [];
        content = (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Modeller</h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {models.map((model) => {
                  const cn = collection.name;
                  const useVar = collectionUsesVariantLevelPreviewImages(cn);
                  const variantLevelCandidates = useVar
                    ? getModelCardVariantLevelCandidates(
                        cn,
                        model.variants ?? [],
                        model.images ?? [],
                      )
                    : undefined;
                  const img = useVar
                    ? null
                    : pickFirstVariantPreviewAmong(cn, model.variants ?? []);
                  return (
                    <Card
                      key={model.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <Link href={`/model/${model.id}`}>
                        <CardContent className="p-4 flex flex-col gap-2">
                          {variantLevelCandidates !== undefined ? (
                            <WikiAwareHotWheelsImage
                              candidates={variantLevelCandidates}
                              altFallback={model.castingName}
                              className="relative w-full h-32 rounded-md overflow-hidden bg-transparent"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          ) : img?.path ? (
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
                            <div className="text-xs text-muted-foreground">
                              {model.variants?.length || 0} varyant
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        );
        break;
      }
      case 'model': {
        const model = await getModelById(shareLink.targetId);
        if (!model) {
          notFound();
        }
        title = model.castingName;
        content = (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Toy #:
                  </span>{' '}
                  <span>{model.castingId ?? '—'}</span>
                </div>
                {model.subSeries && (
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Seri:
                    </span>{' '}
                    <span>
                      {model.subSeries.collection.name} •{' '}
                      {model.subSeries.name}
                    </span>
                  </div>
                )}
                {model.description && (
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Açıklama:
                    </span>{' '}
                    <span>{model.description}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <div>
              <h3 className="text-lg font-semibold mb-4">Varyantlar</h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {model.variants?.map((variant: any) => {
                  const img = variant.images?.[0];
                  return (
                    <Card
                      key={variant.id}
                      className="hover:shadow-md transition-shadow"
                    >
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
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold">
                            #{variant.cardNumber ?? '—'}
                          </div>
                          <div className="text-muted-foreground">
                            {variant.color ?? variant.releaseName ?? '—'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        );
        break;
      }
      case 'variant': {
        const variant = await getVariantById(shareLink.targetId);
        if (!variant) {
          notFound();
        }
        title = `${variant.model.castingName} - Varyant`;
        const img = variant.images?.[0];
        content = (
          <Card>
            <CardContent className="p-6">
              {img?.path ? (
                <div className="relative w-full h-64 rounded-md overflow-hidden bg-transparent mb-4">
                  <Image
                    src={(() => {
                      let normalizedPath = img.path.replace(/\\/g, '/');
                      if (!normalizedPath.startsWith('/')) {
                        normalizedPath = '/' + normalizedPath;
                      }
                      normalizedPath = normalizedPath.replace(/\/+/g, '/');
                      return normalizedPath;
                    })()}
                    alt={variant.model.castingName}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full h-64 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground mb-4">
                  Görsel yok
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Model:
                  </span>{' '}
                  <span>{variant.model.castingName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Yıl:
                  </span>{' '}
                  <span>{variant.year}</span>
                </div>
                {variant.color && (
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Renk:
                    </span>{' '}
                    <span>{variant.color}</span>
                  </div>
                )}
                {variant.cardNumber && (
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Kart #:
                    </span>{' '}
                    <span>{variant.cardNumber}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
        break;
      }
    }
  } catch (error) {
    console.error('Error loading share content:', error);
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">
            Paylaşılan koleksiyon görüntüleme
          </p>
          <p className="text-xs text-muted-foreground">
            {shareLink.viewCount} görüntüleme
          </p>
        </div>
        {content}
      </div>
    </div>
  );
}

