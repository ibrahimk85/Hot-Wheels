// app/variants/[variantId]/page.tsx

import Image from 'next/image';
import Link from 'next/link';
import { getVariantById } from '@/features/variants/variant.service';
import prisma from '@/db';
import { revalidatePath } from 'next/cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VariantImageGallery } from '@/components/VariantImageGallery';
import { ModelNotesAndPrice } from '@/components/ModelNotesAndPrice';

type VariantDetailPageProps = {
  params: Promise<{ variantId: string }>;
};

// Server action: Packed Owned durumunu toggle et
async function togglePackedOwnedAction(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentPackedOwnedRaw = formData.get('currentPackedOwned');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentPackedOwned = currentPackedOwnedRaw === 'true';

  await prisma.variant.update({
    where: { id },
    data: { packedOwned: !currentPackedOwned },
  });

  // Detay sayfasını ve listeyi yeniden oluştur
  revalidatePath(`/variants/${id}`);
  revalidatePath('/variants');
}

// Server action: Loose Owned durumunu toggle et
async function toggleLooseOwnedAction(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentLooseOwnedRaw = formData.get('currentLooseOwned');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentLooseOwned = currentLooseOwnedRaw === 'true';

  await prisma.variant.update({
    where: { id },
    data: { looseOwned: !currentLooseOwned },
  });

  // Detay sayfasını ve listeyi yeniden oluştur
  revalidatePath(`/variants/${id}`);
  revalidatePath('/variants');
}

// Server action: Wish durumunu toggle et
async function toggleWishAction(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentWishRaw = formData.get('currentWish');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentWish = currentWishRaw === 'true';

  await prisma.variant.update({
    where: { id },
    data: { wishlisted: !currentWish },
  });

  revalidatePath(`/variants/${id}`);
  revalidatePath('/variants');
}

export default async function VariantDetailPage({ params }: VariantDetailPageProps) {
  const { variantId } = await params;
  const id = Number(variantId);
  
  if (Number.isNaN(id)) {
    return (
      <div className="p-4">
        Geçersiz varyant ID.
      </div>
    );
  }

  const variant = await getVariantById(id);

  if (!variant) {
    return (
      <div className="p-4">
        Varyant bulunamadı.
      </div>
    );
  }

  const model = variant.model;
  const subSeries = model?.subSeries;
  const collection = subSeries?.collection;
  
  // Get full model data including description, notes, and price fields
  const fullModel = await prisma.model.findUnique({
    where: { id: model.id },
    select: {
      id: true,
      description: true,
      notes: true,
      packedPrice: true,
      loosePrice: true,
      packedPurchasePrice: true,
      packedMarketPrice: true,
      packedOriginalPrice: true,
      loosePurchasePrice: true,
      looseMarketPrice: true,
    },
  });
  
  // For Elite 64: Get carded/packed image from model, then loose images from variant
  // For RLC: Get all images from model (Photo Carded and Photo Loose are both on model level)
  // For Team Transport: Get all images from all variants of this model (same Toy# and Series#)
  let images = variant.images || [];
  
  // Elite 64: Get carded/packed image from model's mainImageId, then add loose images from variant
  if (collection?.name === 'Elite 64') {
    const allImages: typeof images = [];
    
    // First, get carded/packed image from model
    if (model?.mainImageId) {
      const mainImage = await prisma.image.findUnique({
        where: { id: model.mainImageId }
      });
      if (mainImage) {
        allImages.push({
          id: mainImage.id,
          path: mainImage.path,
          alt: mainImage.alt
        });
      }
    } else {
      // Fallback: Find carded/packed image by path
      const modelImages = await prisma.image.findMany({
        where: { modelId: model.id }
      });
      const cardedImage = modelImages.find(img => {
        const path = img.path.toLowerCase();
        return path.includes('carded-') || path.includes('packed-');
      });
      if (cardedImage) {
        allImages.push({
          id: cardedImage.id,
          path: cardedImage.path,
          alt: cardedImage.alt
        });
      }
    }
    
    // Then, add loose images from variant
    if (variant.images && variant.images.length > 0) {
      const looseImages = variant.images.filter(img => {
        const path = img.path.toLowerCase();
        return path.includes('loose-');
      });
      allImages.push(...looseImages);
    }
    
    images = allImages.length > 0 ? allImages : variant.images || [];
  }
  // RLC: Prioritize variant-specific images, fallback to model images
  else if (collection?.name === 'Red Line Club') {
    const allImages: typeof images = [];
    
    // First, check if variant has its own images (variant-specific)
    if (variant.images && variant.images.length > 0) {
      // Variant has specific images, use only those
      const variantCardedImages = variant.images.filter(img => {
        const path = img.path.toLowerCase();
        return path.includes('carded') || path.includes('packed');
      });
      const variantLooseImages = variant.images.filter(img => {
        const path = img.path.toLowerCase();
        return path.includes('loose-');
      });
      
      // Add variant-specific carded images first
      allImages.push(...variantCardedImages.map(img => ({
        id: img.id,
        path: img.path,
        alt: img.alt
      })));
      
      // Then add variant-specific loose images
      allImages.push(...variantLooseImages.map(img => ({
        id: img.id,
        path: img.path,
        alt: img.alt
      })));
    } else {
      // Fallback: Get all images from model (for variants without specific images)
      const modelImages = await prisma.image.findMany({
        where: { modelId: model.id }
      });
      
      if (modelImages.length > 0) {
        // Sort: carded first, then loose images
        const cardedImages = modelImages.filter(img => {
          const path = img.path.toLowerCase();
          return path.includes('carded') || path.includes('image.');
        });
        const looseImages = modelImages.filter(img => {
          const path = img.path.toLowerCase();
          return path.includes('loose-');
        });
        
        // Add carded images first
        allImages.push(...cardedImages.map(img => ({
          id: img.id,
          path: img.path,
          alt: img.alt
        })));
        
        // Then add loose images
        allImages.push(...looseImages.map(img => ({
          id: img.id,
          path: img.path,
          alt: img.alt
        })));
      }
    }
    
    images = allImages.length > 0 ? allImages : variant.images || [];
  }
  // If this is a Team Transport model, get all variants with the same cardNumber and year
  // and collect all their images
  else if (collection?.name === 'Team Transport' && variant.cardNumber && variant.year) {
    const allVariants = await prisma.variant.findMany({
      where: {
        modelId: model.id,
        cardNumber: variant.cardNumber,
        year: variant.year,
      },
      include: {
        images: {
          orderBy: {
            id: 'asc'
          }
        }
      }
    });
    
    // Collect all images from all variants
    const allImages: typeof images = [];
    for (const v of allVariants) {
      if (v.images && v.images.length > 0) {
        allImages.push(...v.images);
      }
    }
    
    // Remove duplicates based on path
    const uniqueImages = allImages.filter((img, index, self) =>
      index === self.findIndex((i) => i.path === img.path)
    );
    
    images = uniqueImages;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">
          {model?.castingName ?? 'Varyant Detayı'}
        </h2>
        <Button variant="outline" asChild>
          <Link href="/variants">← Varyant listesine dön</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
        {/* Görsel */}
        <Card>
          <CardContent className="p-6">
            {images.length > 0 ? (
              <VariantImageGallery
                images={images}
                castingName={model?.castingName ?? 'Hot Wheels'}
                color={variant.color}
                collectionName={collection?.name ?? null}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <span className="text-sm text-muted-foreground">Görsel yok</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle>Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div>
                <span className="font-semibold text-muted-foreground">Model:</span>{' '}
                <span>{model?.castingName ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Toy #:</span>{' '}
                <span>{model?.castingId ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Kart / Koleksiyon No:</span>{' '}
                <span>{variant.cardNumber ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Yıl:</span>{' '}
                <span>{variant.year ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Seri:</span>{' '}
                <span>{collection?.name ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Alt Seri:</span>{' '}
                <span>{subSeries?.name ?? '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Renk / Varyant:</span>{' '}
                <span>{variant.color ?? variant.releaseName ?? '—'}</span>
              </div>
              {variant.theme && (
                <div>
                  <span className="font-semibold text-muted-foreground">Theme:</span>{' '}
                  <span>{variant.theme}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {variant.isTreasureHunt && (
                <span className="px-2 py-1 rounded bg-green-100 text-green-800 font-semibold text-xs">
                  Treasure Hunt
                </span>
              )}
              {variant.isSuperTreasureHunt && (
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 font-semibold text-xs">
                  Super Treasure Hunt
                </span>
              )}
              {(variant.packedOwned || variant.looseOwned) && (
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                  Sende var
                </span>
              )}
              {typeof variant.quantity === 'number' && variant.quantity > 1 && (
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">
                  {variant.quantity} adet
                </span>
              )}
            </div>

            {/* Açıklama */}
            {fullModel?.description && (
              <div className="pt-2 border-t">
                <div className="font-semibold text-sm mb-2">Açıklama:</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {(() => {
                    // Parse description to extract Sale Date and Quantity
                    const description = fullModel.description;
                    if (!description) return null;
                    
                    const lines: string[] = [];
                    
                    // Extract Sale Date
                    const saleDateMatch = description.match(/Sale Date:\s*([^|]+)/i);
                    if (saleDateMatch) {
                      lines.push(`Sale Date: ${saleDateMatch[1].trim()}`);
                    }
                    
                    // Extract Quantity
                    const quantityMatch = description.match(/Quantity:\s*([^|]+)/i);
                    if (quantityMatch) {
                      lines.push(`Quantity: ${quantityMatch[1].trim()}`);
                    }
                    
                    // If no Sale Date or Quantity found, show original description
                    if (lines.length === 0) {
                      return <p className="whitespace-pre-wrap">{description}</p>;
                    }
                    
                    // Show Sale Date and Quantity on separate lines
                    return lines.map((line, index) => (
                      <div key={index}>{line}</div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Variant Notlar (sadece göster) */}
            {variant.notes && (
              <div className="pt-2 border-t">
                <div className="font-semibold text-sm mb-2">Varyant Notları:</div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{variant.notes}</p>
              </div>
            )}

            {/* Model Notlar ve Fiyat */}
            {fullModel && (
              <ModelNotesAndPrice
                modelId={fullModel.id}
                initialNotes={fullModel.notes}
                initialPackedPurchasePrice={fullModel.packedPurchasePrice}
                initialPackedMarketPrice={fullModel.packedMarketPrice}
                initialPackedOriginalPrice={fullModel.packedOriginalPrice}
                initialLoosePurchasePrice={fullModel.loosePurchasePrice}
                initialLooseMarketPrice={fullModel.looseMarketPrice}
              />
            )}

            <div className="flex flex-col gap-2 pt-2 border-t">
              {/* Packed toggle butonu */}
              <form action={togglePackedOwnedAction}>
                <input type="hidden" name="id" value={variant.id} />
                <input
                  type="hidden"
                  name="currentPackedOwned"
                  value={variant.packedOwned ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  variant={variant.packedOwned ? 'default' : 'outline'}
                  className={`w-full ${variant.packedOwned ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  {variant.packedOwned ? 'Packed ✓' : 'Packed'}
                </Button>
              </form>

              {/* Loose toggle butonu */}
              <form action={toggleLooseOwnedAction}>
                <input type="hidden" name="id" value={variant.id} />
                <input
                  type="hidden"
                  name="currentLooseOwned"
                  value={variant.looseOwned ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  variant={variant.looseOwned ? 'default' : 'outline'}
                  className={`w-full ${variant.looseOwned ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {variant.looseOwned ? 'Loose ✓' : 'Loose'}
                </Button>
              </form>

              {/* Wish toggle butonu */}
              <form action={toggleWishAction}>
                <input type="hidden" name="id" value={variant.id} />
                <input
                  type="hidden"
                  name="currentWish"
                  value={variant.wishlisted ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  variant={variant.wishlisted ? 'default' : 'outline'}
                  className="w-full"
                >
                  {variant.wishlisted ? 'Wish ✓' : 'Wish'}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
