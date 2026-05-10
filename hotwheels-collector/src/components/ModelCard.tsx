'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelDetailModal } from '@/components/ModelDetailModal';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MAINLINE_COL_DISPLAY_MAX_YEAR,
  MAINLINE_COL_DISPLAY_MIN_YEAR,
} from '@/lib/mainline';
import {
  collectionUsesVariantLevelPreviewImages,
  getModelCardVariantLevelCandidates,
} from '@/lib/variant-preview-image';
import { WikiAwareHotWheelsImage } from '@/components/WikiAwareHotWheelsImage';

interface ModelCardProps {
  model: {
    id: number;
    castingName: string;
    castingId: string | null;
    mainImageId: number | null;
    owned: boolean;
    wishlisted: boolean;
    quantity: number;
    images: Array<{
      id: number;
      path: string;
      alt: string | null;
    }>;
    variants: Array<{
      id: number;
      cardNumber: string | null;
      isTreasureHunt: boolean;
      isSuperTreasureHunt: boolean;
      year: number;
      imageId?: number | null;
      images: Array<{
        id: number;
        path: string;
        alt: string | null;
      }>;
    }>;
    subSeries: {
      id: number;
      name: string;
      collection: {
        id: number;
        name: string;
      } | null;
    } | null;
  };
  toggleOwnedAction: (formData: FormData) => Promise<void>;
  toggleWishlistAction: (formData: FormData) => Promise<void>;
  updateQuantityAction: (formData: FormData) => Promise<void>;
  deleteModelAction: (formData: FormData) => Promise<void>;
  hideActions?: boolean; // If true, hide the action buttons (Eksik, Wishlist, Quantity)
}

export function ModelCard({
  model: m,
  toggleOwnedAction,
  toggleWishlistAction,
  updateQuantityAction,
  deleteModelAction,
  hideActions = false,
}: ModelCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const subSeries = m.subSeries;
  const collection = subSeries?.collection;

  // For Elite 64: Show only main image (carded/packed or selected main image)
  // For other collections: Show first model image or first variant image
  type ImageType = {
    id: number;
    path: string;
    alt: string | null;
  };
  let mainImg: ImageType | undefined;
  
  if (collectionUsesVariantLevelPreviewImages(collection?.name)) {
    // Preview: WikiAwareHotWheelsImage + getModelCardVariantLevelCandidates (dimension-based placeholder skip)
    mainImg = undefined;
  } else if (collection?.name === 'Elite 64') {
    // First, try to get the main image by mainImageId
    if (m.mainImageId) {
      // Check model images first
      mainImg = m.images?.find(img => img.id === m.mainImageId);
      
      // If not found in model images, check variant images
      if (!mainImg && m.variants) {
        for (const variant of m.variants) {
          if (variant.images) {
            const found = variant.images.find(img => img.id === m.mainImageId);
            if (found) {
              mainImg = found;
              break;
            }
          }
        }
      }
    }
    
    // If mainImageId not set or image not found, get carded/packed image from model images
    if (!mainImg) {
      mainImg = m.images?.find(img => {
        const path = img.path.toLowerCase();
        return path.includes('carded-') || path.includes('packed-');
      });
    }
    
    // If still no image found, use first model image
    if (!mainImg) {
      mainImg = m.images?.[0];
    }
  } else {
    // For other collections: First try mainImageId
    if (m.mainImageId) {
      mainImg = m.images?.find(img => img.id === m.mainImageId);
      
      // If not found in model images, check variant images
      if (!mainImg && m.variants) {
        for (const variant of m.variants) {
          if (variant.images) {
            const found = variant.images.find(img => img.id === m.mainImageId);
            if (found) {
              mainImg = found;
              break;
            }
          }
        }
      }
    }
    
    // If mainImageId not set or image not found, get first model image or variant image
    if (!mainImg) {
      mainImg = m.images && m.images.length > 0
        ? m.images[0]
        : m.variants?.[0]?.images?.[0];
    }
  }
  
  const img = mainImg;

  // Get COL# for Mainline (display year range in lib/mainline.ts)
  const getColNumber = (): string | null => {
    if (collection?.name !== 'Mainline') return null;
    
    const hasValidYear = m.variants?.some(
      v =>
        v.year >= MAINLINE_COL_DISPLAY_MIN_YEAR &&
        v.year <= MAINLINE_COL_DISPLAY_MAX_YEAR,
    );
    if (!hasValidYear) return null;
    
    // Get the first variant's cardNumber
    const cardNumber = m.variants?.[0]?.cardNumber;
    return cardNumber || null;
  };

  const colNumber = getColNumber();

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on buttons or forms
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('form') ||
      target.closest('input')
    ) {
      return;
    }
    e.preventDefault();
    setIsModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    const formData = new FormData();
    formData.append('id', m.id.toString());
    formData.append('collectionName', collection?.name || '');
    await deleteModelAction(formData);
    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };


  return (
    <>
      <Card className="flex flex-col group relative">
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Sil butonu - Sağ üst köşe */}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-7 w-7"
            onClick={handleDeleteClick}
            title="Modeli Sil"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Üst kısım: Modal açma için tıklanabilir */}
          <div
            onClick={handleCardClick}
            className="flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {collection?.name === 'Elite 64' ? (
              // Elite 64: Show only main image (carded/packed or selected main image)
              mainImg?.path ? (
                <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                  <Image
                    src={(() => {
                      let normalizedPath = mainImg.path.replace(/\\/g, '/');
                      if (!normalizedPath.startsWith('/')) {
                        normalizedPath = '/' + normalizedPath;
                      }
                      normalizedPath = normalizedPath.replace(/\/+/g, '/');
                      return normalizedPath;
                    })()}
                    alt={mainImg.alt ?? m.castingName ?? 'Hot Wheels'}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-contain"
                    unoptimized
                  />
                  {colNumber && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs font-semibold">
                      COL#{colNumber}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                  Görsel yok
                </div>
              )
            ) : collectionUsesVariantLevelPreviewImages(collection?.name) ? (
              <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                <WikiAwareHotWheelsImage
                  candidates={getModelCardVariantLevelCandidates(
                    collection?.name ?? null,
                    m.variants,
                    m.images,
                  )}
                  altFallback={m.castingName ?? 'Hot Wheels'}
                />
                {colNumber && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs font-semibold">
                    COL#{colNumber}
                  </div>
                )}
              </div>
            ) : (
              // Other collections: Show single image
              img?.path ? (
                <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                  <Image
                    src={(() => {
                      let normalizedPath = img.path.replace(/\\/g, '/');
                      if (!normalizedPath.startsWith('/')) {
                        normalizedPath = '/' + normalizedPath;
                      }
                      normalizedPath = normalizedPath.replace(/\/+/g, '/');
                      return normalizedPath;
                    })()}
                    alt={img.alt ?? m.castingName ?? 'Hot Wheels'}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-contain"
                    unoptimized
                  />
                  {colNumber && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs font-semibold">
                      COL#{colNumber}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                  Görsel yok
                </div>
              )
            )}

            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {m.castingName ?? 'Bilinmeyen Model'}
              </div>
              <div className="text-xs text-muted-foreground">
                {collection?.name ?? ''} {subSeries ? `• ${subSeries.name}` : ''}
                {m.variants?.[0]?.cardNumber && (
                  <span className="ml-1">• #{m.variants[0].cardNumber}</span>
                )}
              </div>
              {/* TH/STH bilgisi - 2021 yılı için */}
              {m.variants && m.variants.some(v => v.year === 2021) && (() => {
                const variant2021 = m.variants.find(v => v.year === 2021);
                if (variant2021?.isSuperTreasureHunt) {
                  return (
                    <div className="text-xs text-muted-foreground mt-1">
                      Super Treasure Hunt
                    </div>
                  );
                } else if (variant2021?.isTreasureHunt) {
                  return (
                    <div className="text-xs text-muted-foreground mt-1">
                      Treasure Hunt
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Alt kısım: Inline aksiyonlar - Sadece hideActions false ise göster */}
          {!hideActions && (
            <div className="flex flex-wrap gap-2 items-center justify-between mt-auto pt-2 border-t">
              <div className="flex flex-wrap gap-1.5 items-center">
                {/* Owned toggle */}
                <form action={toggleOwnedAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="currentOwned"
                    value={m.owned ? 'true' : 'false'}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant={m.owned ? 'default' : 'outline'}
                    className="h-7 text-xs"
                  >
                    {m.owned ? 'Sende var' : 'Eksik'}
                  </Button>
                </form>

                {/* Wishlist toggle */}
                <form action={toggleWishlistAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="currentWish"
                    value={m.wishlisted ? 'true' : 'false'}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant={m.wishlisted ? 'default' : 'outline'}
                    className="h-7 text-xs"
                  >
                    {m.wishlisted ? "Wishlist'te" : "Wishlist'e ekle"}
                  </Button>
                </form>

                {/* Quantity edit */}
                <form action={updateQuantityAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={m.id} />
                  <Input
                    name="quantity"
                    type="number"
                    min={0}
                    defaultValue={m.quantity ?? 0}
                    className="w-14 h-7 text-xs"
                  />
                  <Button type="submit" size="sm" variant="outline" className="h-7 text-xs">
                    Kaydet
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ModelDetailModal
        modelId={m.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Silme Onay Dialog'u */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modeli Sil</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{m.castingName}</span> modelini silmek istediğinizden emin misiniz?
              <br />
              <span className="text-destructive mt-2 block">
                Bu işlem geri alınamaz. Model ve tüm varyantları kalıcı olarak silinecektir.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Siliniyor...' : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

