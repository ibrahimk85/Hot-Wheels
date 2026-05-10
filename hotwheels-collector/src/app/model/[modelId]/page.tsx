// app/model/[modelId]/page.tsx

import Image from 'next/image';
import Link from 'next/link';
import { getModelById } from '@/features/models/model.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackToModelsButton } from '@/components/BackToModelsButton';
import { VariantComparison } from '@/components/VariantComparison';
import { Recommendations } from '@/components/Recommendations';
import { ShareDialog } from '@/components/ShareDialog';
import { ModelPricePrediction } from '@/components/ModelPricePrediction';
import { ModelPriceTrend } from '@/components/ModelPriceTrend';
import { PriceAlertDialog } from '@/components/PriceAlertDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VariantImageGallery } from '@/components/VariantImageGallery';
import prisma from '@/db';

type ModelDetailPageProps = {
  params: Promise<{ modelId: string }>;
};

// Açıklamadaki JSON formatını temizleyen fonksiyon
function cleanDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  
  const trimmed = description.trim();
  
  // Önce JSON parse denemesi yap (daha güvenilir)
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'description' in parsed && typeof parsed.description === 'string') {
      return parsed.description;
    }
  } catch {
    // JSON parse edilemezse devam et
  }
  
  // Eğer {"description": "..."} formatındaysa regex ile yakala
  // Bu durumda escape edilmiş karakterler olabilir, bu yüzden JSON.parse daha iyi
  // Ama yine de regex ile basit durumları yakalayabiliriz
  const jsonMatch = trimmed.match(/^\{\s*"description"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\s*\}$/);
  if (jsonMatch) {
    // Escape edilmiş karakterleri decode et
    return jsonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  
  // Zaten temiz bir metinse, olduğu gibi döndür
  return description;
}

export default async function ModelDetailPage({ params }: ModelDetailPageProps) {
  const { modelId } = await params;
  const id = Number(modelId);
  
  if (Number.isNaN(id)) {
    return <div className="p-4">Geçersiz model ID.</div>;
  }

  const model = await getModelById(id);

  if (!model) {
    return <div className="p-4">Model bulunamadı.</div>;
  }

  const subSeries = model.subSeries;
  const collection = subSeries?.collection;
  const variants = model.variants ?? [];
  const cleanedDescription = cleanDescription(model.description);

  // For Team Transport and Elite 64: Collect all images (carded from model.mainImageId + loose from all variants)
  let allModelImages: Array<{ id: number; path: string; alt?: string | null }> = [];
  
  if (collection?.name === 'Team Transport' || collection?.name === 'Elite 64') {
    // For Elite 64: Get carded/packed image first, then loose images
    if (collection?.name === 'Elite 64') {
      // Get carded/packed image from model (main image)
      if (model.mainImageId) {
        const mainImage = await prisma.image.findUnique({
          where: { id: model.mainImageId }
        });
        if (mainImage) {
          allModelImages.push({
            id: mainImage.id,
            path: mainImage.path,
            alt: mainImage.alt
          });
        }
      } else {
        // Fallback: Find carded/packed image by path
        const cardedImage = model.images?.find(img => {
          const path = img.path.toLowerCase();
          return path.includes('carded-') || path.includes('packed-');
        });
        if (cardedImage) {
          allModelImages.push({
            id: cardedImage.id,
            path: cardedImage.path,
            alt: cardedImage.alt
          });
        }
      }
      
      // Get all loose images from all variants
      for (const variant of variants) {
        if (variant.images && variant.images.length > 0) {
          for (const img of variant.images) {
            const path = img.path.toLowerCase();
            // Only add loose images
            if (path.includes('loose-')) {
              // Check if already added (avoid duplicates)
              if (!allModelImages.find(i => i.path === img.path)) {
                allModelImages.push({
                  id: img.id,
                  path: img.path,
                  alt: img.alt
                });
              }
            }
          }
        }
      }
    } else if (collection?.name === 'Team Transport') {
      // Get main image (Photo Carded) if exists
      if (model.mainImageId) {
        const mainImage = await prisma.image.findUnique({
          where: { id: model.mainImageId }
        });
        if (mainImage) {
          allModelImages.push({
            id: mainImage.id,
            path: mainImage.path,
            alt: mainImage.alt
          });
        }
      }
      
      // Get all loose images from all variants
      for (const variant of variants) {
        if (variant.images && variant.images.length > 0) {
          for (const img of variant.images) {
            const path = img.path.toLowerCase();
            // Only add loose images
            if (path.includes('loose-') || path.includes('_loose') || path.includes('/loose')) {
              // Check if already added (avoid duplicates)
              if (!allModelImages.find(i => i.path === img.path)) {
                allModelImages.push({
                  id: img.id,
                  path: img.path,
                  alt: img.alt
                });
              }
            }
          }
        }
      }
    }
  } else {
    // For other collections, use model's main image if exists
    if (model.mainImageId) {
      const mainImage = await prisma.image.findUnique({
        where: { id: model.mainImageId }
      });
      if (mainImage) {
        allModelImages.push({
          id: mainImage.id,
          path: mainImage.path,
          alt: mainImage.alt
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{model.castingName}</h2>
        <div className="flex items-center gap-2">
          <PriceAlertDialog modelId={model.id} />
          <ShareDialog
            type="model"
            targetId={model.id}
            targetName={model.castingName}
          />
          <BackToModelsButton />
        </div>
      </div>

      {/* Image Gallery - Show for Team Transport or if model has images */}
      {allModelImages.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <VariantImageGallery
              images={allModelImages}
              castingName={model.castingName}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Model Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-semibold text-muted-foreground">Toy #:</span>{' '}
            <span>{model.castingId ?? '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground">Seri:</span>{' '}
            <span>{collection?.name ?? '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground">Alt Seri:</span>{' '}
            <span>{subSeries?.name ?? '—'}</span>
          </div>
          {model.debutSeries && (
            <div>
              <span className="font-semibold text-muted-foreground">Debut Series:</span>{' '}
              <span>{model.debutSeries}</span>
            </div>
          )}
          {model.produced && (
            <div>
              <span className="font-semibold text-muted-foreground">Produced:</span>{' '}
              <span>{model.produced}</span>
            </div>
          )}
          {model.designer && (
            <div>
              <span className="font-semibold text-muted-foreground">Designer:</span>{' '}
              <span>{model.designer}</span>
            </div>
          )}
          {model.castingNumber && (
            <div>
              <span className="font-semibold text-muted-foreground">Number:</span>{' '}
              <span>{model.castingNumber}</span>
            </div>
          )}
          {cleanedDescription && (
            <div className="pt-2 border-t">
              <div className="font-semibold mb-2">Açıklama:</div>
              <p className="whitespace-pre-wrap text-muted-foreground">{cleanedDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Tüm Varyantlar</h3>
          {variants.length > 1 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Tüm Varyantları Karşılaştır</Button>
              </DialogTrigger>
              <DialogContent className="max-w-screen-xl h-[90vh] p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>{model.castingName} - Tüm Varyantlar</DialogTitle>
                </DialogHeader>
                <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                  <VariantComparison
                    variants={variants.map((v: any) => ({
                      id: v.id,
                      year: v.year,
                      color: v.color,
                      releaseName: v.releaseName,
                      cardNumber: v.cardNumber,
                      isTreasureHunt: v.isTreasureHunt,
                      isSuperTreasureHunt: v.isSuperTreasureHunt,
                      images: v.images || [],
                    }))}
                    modelName={model.castingName}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {variants.map((v: any) => {
            const img = v.images?.[0];
            return (
              <Card key={v.id} className="hover:shadow-md transition-shadow">
                <Link href={`/variants/${v.id}`}>
                  <CardContent className="p-4 flex flex-col gap-2">
                    {img?.path ? (
                      <div className="relative w-full h-32 rounded-md overflow-hidden bg-transparent">
                        <Image
                          src={(() => {
                            let normalizedPath = img.path.replace(/\\/g, '/');
                            if (!normalizedPath.startsWith('/')) {
                              normalizedPath = '/' + normalizedPath;
                            }
                            normalizedPath = normalizedPath.replace(/\/+/g, '/');
                            return normalizedPath;
                          })()}
                          alt={img.alt ?? model.castingName}
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
                      <div className="font-semibold">#{v.cardNumber ?? '—'}</div>
                      <div className="text-muted-foreground">
                        {v.color ?? v.releaseName ?? '—'}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.isTreasureHunt && (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                            TH
                          </span>
                        )}
                        {v.isSuperTreasureHunt && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                            STH
                          </span>
                        )}
                        {v.owned && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Sende var
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>

      <Recommendations modelId={model.id} />

      <ModelPricePrediction modelId={model.id} modelName={model.castingName} />

      <ModelPriceTrend modelId={model.id} />
    </div>
  );
}
