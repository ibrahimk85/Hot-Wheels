'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VariantDetailModal } from './VariantDetailModal';
import { ImageSearchDialog } from './ImageSearchDialog';
import { Trash2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isMainlineOrdinalColorVariant,
  mainlineOrdinalColorBadgeText,
} from '@/lib/mainline-color-variant';
import {
  collectionUsesVariantLevelPreviewImages,
  getVariantLevelPreviewCandidates,
} from '@/lib/variant-preview-image';
import { WikiAwareHotWheelsImage } from '@/components/WikiAwareHotWheelsImage';

interface VariantCardProps {
  variant: {
    id: number;
    cardNumber: string | null;
    color: string | null;
    toyNumber: string | null;
    isTreasureHunt: boolean;
    isSuperTreasureHunt: boolean;
    year: number;
    owned: boolean; // Eski alan (geriye dönük uyumluluk)
    packedOwned: boolean;
    looseOwned: boolean;
    wishlisted: boolean;
    quantity: number;
    imageId: number | null;
    images: Array<{
      id: number;
      path: string;
      alt: string | null;
    }>;
    model: {
      id: number;
      castingName: string;
      toyNumber?: string | null;
      images?: Array<{
        id: number;
        path: string;
        alt: string | null;
      }>;
      subSeries: {
        id: number;
        name: string;
        collection: {
          id: number;
          name: string;
          year?: {
            year: number;
          } | null;
        } | null;
      } | null;
    } | null;
  };
  togglePackedOwnedAction: (formData: FormData) => Promise<void>;
  toggleLooseOwnedAction: (formData: FormData) => Promise<void>;
  toggleWishAction: (formData: FormData) => Promise<void>;
  updateQuantityAction: (formData: FormData) => Promise<void>;
  deleteModelAction: (formData: FormData) => Promise<void>;
}

export function VariantCard({
  variant: v,
  togglePackedOwnedAction,
  toggleLooseOwnedAction,
  toggleWishAction,
  updateQuantityAction,
  deleteModelAction,
}: VariantCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const model = v.model;
  const subSeries = model?.subSeries;
  const collection = subSeries?.collection;
  const displayYear = collection?.year?.year ?? v.year;
  
  const colorVariantText =
    collection?.name === 'Mainline' ? mainlineOrdinalColorBadgeText(v.color) : null;
  
  // Get model data for image search (with 2nd/3rd color support)
  const getModelDataForSearch = () => {
    if (!model?.id) return null;
    
    // For Mainline: Check if this is a 2nd/3rd color variant
    let toyNumberForSearch = v.toyNumber || model?.toyNumber || undefined;
    
    if (collection?.name === 'Mainline' && v.color && isMainlineOrdinalColorVariant(v.color)) {
      toyNumberForSearch = v.toyNumber || undefined;
    }
    
    return {
      castingName: model.castingName,
      year: v.year,
      collectionName: collection?.name,
      toyNumber: toyNumberForSearch,
      cardNumber: v.cardNumber || undefined,
    };
  };
  
  // For all collections: Check model images first (since images are saved to model level)
  // Then fallback to variant images
  // Exceptions: Fast & Furious and Neon Speeders store images at variant level, so check variant images first
  let img: { id: number; path: string; alt: string | null } | undefined;
  
  // Boulevard / F&F / F&F Premium / Neon: preview via WikiAwareHotWheelsImage (decoded size skips Fandom placeholders)
  if (collectionUsesVariantLevelPreviewImages(collection?.name)) {
    img = undefined;
  } else if ((collection?.name === 'Team Transport' || collection?.name === 'Red Line Club') && model?.images && model.images.length > 0) {
    // Find carded/image in model images (for RLC: look for "carded" or "image")
    const cardedImage = model.images.find((i: any) => {
      const path = i.path.toLowerCase();
      return path.includes('carded') || path.includes('image.') || path.includes('_carded') || path.includes('/carded');
    });
    img = cardedImage || model.images[0];
  } else {
    // For other collections (Mainline, etc.): 
    // Mainline: Each variant has its own image (1st, 2nd, 3rd color), so prioritize variant images
    // Other collections: Images are saved to model level, so check model images first
    if (collection?.name === 'Mainline') {
      // Mainline: Check variant images first (each color variant has its own image)
      if (v.imageId && v.images && v.images.length > 0) {
        // Use variant image by imageId (this is the correct image for this color variant)
        img = v.images.find((i: any) => i.id === v.imageId) || v.images[0];
      } else if (v.images && v.images.length > 0) {
        // Fallback to first variant image
        img = v.images[0];
      } else if (model?.images && model.images.length > 0) {
        // Fallback: Find model image matching this variant's color
        // Look for images with _1st, _2nd, _3rd in path based on variant color
        const colorVariant = v.color?.toLowerCase() || '';
        let matchingImage = null;
        
        if (colorVariant.includes('2nd')) {
          matchingImage = model.images.find((i: any) => 
            i.path.toLowerCase().includes('_2nd') || i.path.toLowerCase().includes('_002_2nd')
          );
        } else if (colorVariant.includes('3rd')) {
          matchingImage = model.images.find((i: any) => 
            i.path.toLowerCase().includes('_3rd') || i.path.toLowerCase().includes('_003_3rd')
          );
        } else if (colorVariant.includes('4th')) {
          matchingImage = model.images.find((i: any) =>
            i.path.toLowerCase().includes('_4th') || i.path.toLowerCase().includes('4th-color'),
          );
        } else if (colorVariant.includes('5th')) {
          matchingImage = model.images.find((i: any) =>
            i.path.toLowerCase().includes('_5th') || i.path.toLowerCase().includes('5th-color'),
          );
        } else {
          // 1st color or no color specified - look for _1st or default
          matchingImage = model.images.find((i: any) => 
            i.path.toLowerCase().includes('_1st') || i.path.toLowerCase().includes('_001_1st')
          ) || model.images[0];
        }
        
        img = matchingImage || model.images[0];
      }
    } else {
      // Other collections: Check model images first
      if (model?.images && model.images.length > 0) {
        img = model.images[0];
      } else if (v.imageId && v.images && v.images.length > 0) {
        img = v.images.find((i: any) => i.id === v.imageId) || v.images[0];
      } else if (v.images && v.images.length > 0) {
        img = v.images[0];
      }
    }
  }

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
    if (!model?.id) return;
    setIsDeleting(true);
    const formData = new FormData();
    formData.append('id', model.id.toString());
    await deleteModelAction(formData);
    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };


  return (
    <>
      <Card className="flex flex-col group relative">
        {/* Sil butonu - Sağ üst köşe */}
        {model?.id && (
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
        )}
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Üst kısım: Modal açma için tıklanabilir */}
          <div
            onClick={handleCardClick}
            className="flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {collectionUsesVariantLevelPreviewImages(collection?.name) ? (
              <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                <WikiAwareHotWheelsImage
                  candidates={getVariantLevelPreviewCandidates(
                    collection?.name ?? null,
                    { imageId: v.imageId, images: v.images },
                    model?.images ?? null,
                  )}
                  altFallback={model?.castingName ?? 'Hot Wheels'}
                />
                {colorVariantText && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs font-semibold">
                    {colorVariantText}
                  </div>
                )}
              </div>
            ) : img?.path ? (
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
                  alt={img.alt ?? model?.castingName ?? 'Hot Wheels'}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain"
                  unoptimized
                />
                {colorVariantText && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs font-semibold">
                    {colorVariantText}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                Görsel yok
              </div>
            )}

            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {model?.castingName ?? 'Bilinmeyen Model'}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">
                  {displayYear}
                </span>
                {' • '}
                <span className="font-mono">
                  {v.cardNumber ?? '—'}
                </span>
                {' • '}
                {collection?.name ?? ''}
                {subSeries ? ` • ${subSeries.name}` : ''}
              </div>
              {/* TH/STH bilgisi - 2021 yılı için */}
              {v.year === 2021 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {v.isSuperTreasureHunt
                    ? 'Super Treasure Hunt'
                    : v.isTreasureHunt
                    ? 'Treasure Hunt'
                    : null}
                </div>
              )}
            </div>
          </div>

          {/* Alt kısım: Inline aksiyonlar */}
          <div className="flex flex-wrap gap-2 items-center justify-between mt-auto pt-2 border-t">
            <div className="flex flex-wrap gap-1">
              {v.isTreasureHunt && (
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">
                  TH
                </span>
              )}
              {v.isSuperTreasureHunt && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-semibold">
                  STH
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {/* Packed toggle */}
              <form action={togglePackedOwnedAction}>
                <input type="hidden" name="id" value={v.id} />
                <input
                  type="hidden"
                  name="currentPackedOwned"
                  value={v.packedOwned ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={v.packedOwned ? 'default' : 'outline'}
                  className={`h-7 text-xs ${v.packedOwned ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  {v.packedOwned ? 'Packed' : 'Packed'}
                </Button>
              </form>

              {/* Loose toggle */}
              <form action={toggleLooseOwnedAction}>
                <input type="hidden" name="id" value={v.id} />
                <input
                  type="hidden"
                  name="currentLooseOwned"
                  value={v.looseOwned ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={v.looseOwned ? 'default' : 'outline'}
                  className={`h-7 text-xs ${v.looseOwned ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {v.looseOwned ? 'Loose' : 'Loose'}
                </Button>
              </form>

              {/* Wish toggle */}
              <form action={toggleWishAction}>
                <input type="hidden" name="id" value={v.id} />
                <input
                  type="hidden"
                  name="currentWish"
                  value={v.wishlisted ? 'true' : 'false'}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={v.wishlisted ? 'default' : 'outline'}
                  className="h-7 text-xs"
                >
                  {v.wishlisted ? 'Wish' : 'Wish'}
                </Button>
              </form>

              {/* Quantity edit */}
              <form action={updateQuantityAction} className="flex items-center gap-1">
                <input type="hidden" name="id" value={v.id} />
                <Input
                  name="quantity"
                  type="number"
                  min={0}
                  defaultValue={v.quantity ?? 0}
                  className="w-14 h-7 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" className="h-7 text-xs">
                  Kaydet
                </Button>
              </form>

              {/* Image Search Button */}
              {model?.id && (
                <Button
                  type="button"
                  size="sm"
                  variant={img ? 'outline' : 'default'}
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImageSearchOpen(true);
                  }}
                >
                  <Search className="mr-1 h-3 w-3" />
                  {img ? 'Resim Değiştir' : 'Resim Ara'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Search Dialog */}
      {model?.id && getModelDataForSearch() && (
        <ImageSearchDialog
          open={isImageSearchOpen}
          onOpenChange={setIsImageSearchOpen}
          modelId={model.id}
          modelData={getModelDataForSearch()!}
        />
      )}

      <VariantDetailModal
        variantId={v.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Silme Onay Dialog'u */}
      {model?.id && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modeli Sil</DialogTitle>
              <DialogDescription>
                <span className="font-semibold">{model.castingName}</span> modelini silmek istediğinizden emin misiniz?
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
      )}
    </>
  );
}


