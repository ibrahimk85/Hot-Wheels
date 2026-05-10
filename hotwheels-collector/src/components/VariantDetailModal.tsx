'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VariantImageGallery } from '@/components/VariantImageGallery';
import { ModelNotesAndPrice } from '@/components/ModelNotesAndPrice';
import { ImageSearchDialog } from './ImageSearchDialog';
import { Search, Trash2 } from 'lucide-react';
import { isMainlineOrdinalColorVariant } from '@/lib/mainline-color-variant';

interface VariantDetailModalProps {
  variantId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

interface VariantData {
  id: number;
  year: number;
  cardNumber: string | null;
  color: string | null;
  toyNumber: string | null;
  releaseName: string | null;
  isTreasureHunt: boolean;
  isSuperTreasureHunt: boolean;
  owned: boolean; // Eski alan (geriye dönük uyumluluk)
  packedOwned: boolean;
  looseOwned: boolean;
  wishlisted: boolean;
  quantity: number;
  notes: string | null;
  images: Array<{
    id: number;
    path: string;
    alt: string | null;
  }>;
  model: {
    id: number;
    castingName: string;
    castingId: string | null;
    toyNumber?: string | null;
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
}

interface VariantMultipackInfo {
  id: number;
  year: number;
  packageCode: string;
  themeName: string;
  collectionId: number;
  collectionName: string;
}

export function VariantDetailModal({
  variantId,
  isOpen,
  onClose,
}: VariantDetailModalProps) {
  const router = useRouter();
  const [variant, setVariant] = useState<VariantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [modelMainImageId, setModelMainImageId] = useState<number | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [modelData, setModelData] = useState<{
    id: number;
    notes: string | null;
    packedPurchasePrice: number | null;
    packedMarketPrice: number | null;
    packedOriginalPrice: number | null;
    loosePurchasePrice: number | null;
    looseMarketPrice: number | null;
  } | null>(null);
  const [multipacks, setMultipacks] = useState<VariantMultipackInfo[]>([]);

  useEffect(() => {
    if (isOpen && variantId) {
      setLoading(true);
      setMultipacks([]);
      // Fetch variant details
      fetch(`/api/variants/${variantId}`)
        .then((res) => res.json())
        .then((data) => {
          setVariant(data);
          setLoading(false);
          
          // Fetch model data for notes and prices
          if (data?.model?.id) {
            fetch(`/api/models/${data.model.id}`)
              .then((res) => res.json())
              .then((modelRes) => {
                setModelData({
                  id: modelRes.id,
                  notes: modelRes.notes,
                  packedPurchasePrice: modelRes.packedPurchasePrice,
                  packedMarketPrice: modelRes.packedMarketPrice,
                  packedOriginalPrice: modelRes.packedOriginalPrice,
                  loosePurchasePrice: modelRes.loosePurchasePrice,
                  looseMarketPrice: modelRes.looseMarketPrice,
                });
                setModelMainImageId(modelRes.mainImageId || null);
                setModelMainImageId(modelRes.mainImageId || null);
              })
              .catch((err) => {
                console.error('Error fetching model data:', err);
              });
          }
          // Fetch themed multipacks for this variant (if any)
          fetch(`/api/variants/${variantId}/multipacks`)
            .then((res) => (res.ok ? res.json() : []))
            .then((mpData) => {
              if (Array.isArray(mpData)) {
                setMultipacks(mpData);
              }
            })
            .catch((err) => {
              console.error('Error fetching variant multipacks:', err);
            });
        })
        .catch((err) => {
          console.error('Error fetching variant:', err);
          setLoading(false);
        });
    } else {
      setVariant(null);
      setModelData(null);
      setMultipacks([]);
    }
  }, [isOpen, variantId]);

  if (!variantId) return null;

  const model = variant?.model;
  const subSeries = model?.subSeries;
  const collection = subSeries?.collection;
  
  // For Team Transport: Collect Photo Carded (from model) + all loose images from all variants
  // For RLC: Get all images from model (Photo Carded and Photo Loose are both on model level)
  // We'll fetch model data separately to get all images
  const [allImages, setAllImages] = useState<Array<{ id: number; path: string; alt: string | null }>>(variant?.images || []);
  
  useEffect(() => {
    if (variant && model?.id) {
      // Fetch model with all images for ALL collections (not just Team Transport/RLC)
      // Images are saved to model level, so we need to get them from model
      fetch(`/api/models/${model.id}`)
        .then((res) => res.json())
        .then((modelData) => {
          const collectedImages: Array<{ id: number; path: string; alt: string | null }> = [];
          
          if (collection?.name === 'Team Transport') {
            // Get main image (Photo Carded) from model
            const cardedImage = modelData.images?.find((img: any) => {
              const path = img.path.toLowerCase();
              return path.includes('carded-') || path.includes('_carded') || path.includes('/carded');
            });
            
            if (cardedImage) {
              collectedImages.push(cardedImage);
            }
            
            // Get all loose images from all variants
            if (modelData.variants && modelData.variants.length > 0) {
              const looseImages: Array<{ id: number; path: string; alt: string | null }> = [];
              for (const v of modelData.variants) {
                if (v.images && v.images.length > 0) {
                  for (const img of v.images) {
                    const path = img.path.toLowerCase();
                    // Only add loose images
                    if (path.includes('loose-') || path.includes('_loose') || path.includes('/loose')) {
                      // Check if already added (avoid duplicates)
                      if (!looseImages.find(i => i.path === img.path)) {
                        looseImages.push(img);
                      }
                    }
                  }
                }
              }
              collectedImages.push(...looseImages);
            }
          } else if (collection?.name === 'Red Line Club') {
            // RLC: Get all images from model (carded first, then loose)
            if (modelData.images && modelData.images.length > 0) {
              const cardedImages = modelData.images.filter((img: any) => {
                const path = img.path.toLowerCase();
                return path.includes('carded') || path.includes('image.');
              });
              const looseImages = modelData.images.filter((img: any) => {
                const path = img.path.toLowerCase();
                return path.includes('loose-');
              });
              
              collectedImages.push(...cardedImages);
              collectedImages.push(...looseImages);
            }
          } else {
            // For other collections (Mainline, etc.): Get all images from model
            // Images are saved to model level, so get them from modelData.images
            if (modelData.images && modelData.images.length > 0) {
              // Add all model images
              collectedImages.push(...modelData.images);
            }
            
            // Also add variant images if any (for backward compatibility)
            if (variant?.images && variant.images.length > 0) {
              for (const variantImg of variant.images) {
                // Avoid duplicates
                if (!collectedImages.find(img => img.id === variantImg.id || img.path === variantImg.path)) {
                  collectedImages.push(variantImg);
                }
              }
            }
          }
          
          setAllImages(collectedImages.length > 0 ? collectedImages : variant?.images || []);
        })
        .catch((err) => {
          console.error('Error fetching model for images:', err);
          // Fallback to variant images if model fetch fails
          setAllImages(variant?.images || []);
        });
    } else {
      setAllImages(variant?.images || []);
    }
  }, [variant, model?.id, collection?.name]);
  
  const images = allImages;

  // Get model data for image search (with 2nd/3rd/4th color support)
  const getModelDataForSearch = () => {
    if (!variant || !model) return null;
    
    let toyNumberForSearch = variant.toyNumber || model.toyNumber || undefined;
    
    if (collection?.name === 'Mainline' && variant.color && isMainlineOrdinalColorVariant(variant.color)) {
      toyNumberForSearch = variant.toyNumber || undefined;
    }
    
    return {
      castingName: model.castingName,
      year: variant.year,
      collectionName: collection?.name,
      toyNumber: toyNumberForSearch,
      cardNumber: variant.cardNumber || undefined,
    };
  };

  const refreshVariantAndModelData = async () => {
    if (!variantId) return;
    setLoading(true);
    try {
      // Fetch variant details
      const variantRes = await fetch(`/api/variants/${variantId}`);
      const variantData = await variantRes.json();
      setVariant(variantData);
      
      // Fetch model data for notes and prices
      if (variantData?.model?.id) {
        const modelRes = await fetch(`/api/models/${variantData.model.id}`);
        const modelResData = await modelRes.json();
        setModelData({
          id: modelResData.id,
          notes: modelResData.notes,
          packedPurchasePrice: modelResData.packedPurchasePrice,
          packedMarketPrice: modelResData.packedMarketPrice,
          loosePurchasePrice: modelResData.loosePurchasePrice,
          looseMarketPrice: modelResData.looseMarketPrice,
        });
        setModelMainImageId(modelResData.mainImageId || null);
        
        // Get collection name from variantData
        const currentCollection = variantData?.model?.subSeries?.collection;
        
        // Update images
        const collectedImages: Array<{ id: number; path: string; alt: string | null }> = [];
        
        if (currentCollection?.name === 'Team Transport') {
          const cardedImage = modelResData.images?.find((img: any) => {
            const path = img.path.toLowerCase();
            return path.includes('carded-') || path.includes('_carded') || path.includes('/carded');
          });
          if (cardedImage) {
            collectedImages.push(cardedImage);
          }
          if (modelResData.variants && modelResData.variants.length > 0) {
            const looseImages: Array<{ id: number; path: string; alt: string | null }> = [];
            for (const v of modelResData.variants) {
              if (v.images && v.images.length > 0) {
                for (const img of v.images) {
                  const path = img.path.toLowerCase();
                  if (path.includes('loose-') || path.includes('_loose') || path.includes('/loose')) {
                    if (!looseImages.find(i => i.path === img.path)) {
                      looseImages.push(img);
                    }
                  }
                }
              }
            }
            collectedImages.push(...looseImages);
          }
        } else if (currentCollection?.name === 'Red Line Club') {
          if (modelResData.images && modelResData.images.length > 0) {
            const cardedImages = modelResData.images.filter((img: any) => {
              const path = img.path.toLowerCase();
              return path.includes('carded') || path.includes('image.');
            });
            collectedImages.push(...cardedImages);
            
            const looseImages = modelResData.images.filter((img: any) => {
              const path = img.path.toLowerCase();
              return path.includes('loose');
            });
            collectedImages.push(...looseImages);
          }
        } else {
          // For other collections, combine variant and model images
          if (variantData.images) {
            for (const variantImg of variantData.images) {
              if (!collectedImages.find(img => img.id === variantImg.id || img.path === variantImg.path)) {
                collectedImages.push(variantImg);
              }
            }
          }
          if (modelResData.images) {
            for (const modelImg of modelResData.images) {
              if (!collectedImages.find(img => img.id === modelImg.id || img.path === modelImg.path)) {
                collectedImages.push(modelImg);
              }
            }
          }
        }
        
        setAllImages(collectedImages.length > 0 ? collectedImages : variantData?.images || []);
      } else {
        setAllImages(variantData.images || []);
      }
    } catch (err) {
      console.error('Error refreshing variant/model data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Refresh the page after modal closes to update any changes
    router.refresh();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {loading ? 'Yükleniyor...' : model?.castingName ?? 'Varyant Detayı'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <span className="text-sm text-muted-foreground">Yükleniyor...</span>
          </div>
        )}

        {!loading && variant && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            {/* Görsel */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Görseller</h3>
                  <div className="flex gap-2">
                    {model?.id && (
                      <Button
                        size="sm"
                        variant={images.length > 0 ? 'outline' : 'default'}
                        onClick={() => setIsImageSearchOpen(true)}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        {images.length > 0 ? 'Resim Ara' : 'Resim Ara'}
                      </Button>
                    )}
                    {images.length > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!confirm('Bu resmi silmek istediğinizden emin misiniz?')) {
                            return;
                          }
                          
                          // Silinecek resmi belirle: önce mainImageId'ye sahip resmi, yoksa ilk resmi
                          const imageToDelete = modelMainImageId 
                            ? images.find(img => img.id === modelMainImageId) || images[0]
                            : images[0];
                          
                          if (!imageToDelete) return;
                          
                          setIsDeletingImage(true);
                          try {
                            const response = await fetch(`/api/images/${imageToDelete.id}`, {
                              method: 'DELETE',
                            });
                            
                            if (response.ok) {
                              await refreshVariantAndModelData();
                            } else {
                              const error = await response.json();
                              alert(error.error || 'Resim silinirken bir hata oluştu');
                            }
                          } catch (error) {
                            console.error('Error deleting image:', error);
                            alert('Resim silinirken bir hata oluştu');
                          } finally {
                            setIsDeletingImage(false);
                          }
                        }}
                        disabled={isDeletingImage}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isDeletingImage ? 'Siliniyor...' : 'Resmi Sil'}
                      </Button>
                    )}
                  </div>
                </div>
                {images.length > 0 || model?.id ? (
                  <VariantImageGallery
                    images={images}
                    castingName={model?.castingName ?? 'Hot Wheels'}
                    modelId={model?.id ?? 0}
                    mainImageId={modelMainImageId}
                    onImageUpdate={async () => {
                      // Refresh variant and model data to get updated images
                      if (variantId) {
                        setLoading(true);
                        try {
                          // Fetch variant data
                          const variantRes = await fetch(`/api/variants/${variantId}`);
                          const variantData = await variantRes.json();
                          setVariant(variantData);
                          
                          // Fetch model data to get updated images
                          if (variantData?.model?.id) {
                            const modelRes = await fetch(`/api/models/${variantData.model.id}`);
                            const modelData = await modelRes.json();
                            
                            // Update model data state
                            setModelData({
                              id: modelData.id,
                              notes: modelData.notes,
                              packedPurchasePrice: modelData.packedPurchasePrice,
                              packedMarketPrice: modelData.packedMarketPrice,
                              loosePurchasePrice: modelData.loosePurchasePrice,
                              looseMarketPrice: modelData.looseMarketPrice,
                            });
                            setModelMainImageId(modelData.mainImageId || null);
                            
                            // Update images: combine model images with variant images
                            const allModelImages = modelData.images || [];
                            const variantImages = variantData.images || [];
                            const combinedImages = [...allModelImages];
                            
                            // Add variant images that aren't already in model images
                            for (const variantImg of variantImages) {
                              if (!combinedImages.find(img => img.id === variantImg.id || img.path === variantImg.path)) {
                                combinedImages.push(variantImg);
                              }
                            }
                            
                            setAllImages(combinedImages);
                          }
                        } catch (err) {
                          console.error('Error refreshing data:', err);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <span className="text-sm text-muted-foreground">
                      Görsel yok
                    </span>
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
                    <span className="font-semibold text-muted-foreground">
                      Model:
                    </span>{' '}
                    <span>{model?.castingName ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Toy #:
                    </span>{' '}
                    <span>{model?.castingId ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Kart / Koleksiyon No:
                    </span>{' '}
                    <span>{variant.cardNumber ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Yıl:
                    </span>{' '}
                    <span>{variant.year ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Seri:
                    </span>{' '}
                    <span>{collection?.name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Alt Seri:
                    </span>{' '}
                    <span>{subSeries?.name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Renk / Varyant:
                    </span>{' '}
                    <span>{variant.color ?? variant.releaseName ?? '—'}</span>
                  </div>
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
                  {variant.packedOwned && (
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                      Packed
                    </span>
                  )}
                  {variant.looseOwned && (
                    <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-xs">
                      Loose
                    </span>
                  )}
                  {typeof variant.quantity === 'number' &&
                    variant.quantity > 1 && (
                      <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">
                        {variant.quantity} adet
                      </span>
                    )}
                </div>

                {variant.notes && (
                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-2">Varyant Notları:</div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {variant.notes}
                    </p>
                  </div>
                )}

                {multipacks.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-2">
                      Themed Multipack&apos;ler
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {multipacks.map((mp) => (
                        <li key={mp.id}>
                          {mp.year} – {mp.packageCode} – {mp.themeName}
                          {mp.collectionName
                            ? ` (${mp.collectionName})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Model Notlar ve Fiyat */}
                {modelData && (
                  <ModelNotesAndPrice
                    modelId={modelData.id}
                    initialNotes={modelData.notes}
                    initialPackedPurchasePrice={modelData.packedPurchasePrice}
                    initialPackedMarketPrice={modelData.packedMarketPrice}
                    initialPackedOriginalPrice={modelData.packedOriginalPrice}
                    initialLoosePurchasePrice={modelData.loosePurchasePrice}
                    initialLooseMarketPrice={modelData.looseMarketPrice}
                  />
                )}

                {/* Packed, Loose, Wish Butonları */}
                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button
                    variant={variant.packedOwned ? 'default' : 'outline'}
                    className={`w-full ${variant.packedOwned ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    onClick={async () => {
                      if (!variantId) return;
                      try {
                        await fetch(`/api/variants/${variantId}/toggle-packed-owned`, {
                          method: 'POST',
                        });
                        await refreshVariantAndModelData();
                      } catch (error) {
                        console.error('Error toggling packed owned:', error);
                      }
                    }}
                  >
                    {variant.packedOwned ? 'Packed ✓' : 'Packed'}
                  </Button>

                  <Button
                    variant={variant.looseOwned ? 'default' : 'outline'}
                    className={`w-full ${variant.looseOwned ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                    onClick={async () => {
                      if (!variantId) return;
                      try {
                        await fetch(`/api/variants/${variantId}/toggle-loose-owned`, {
                          method: 'POST',
                        });
                        await refreshVariantAndModelData();
                      } catch (error) {
                        console.error('Error toggling loose owned:', error);
                      }
                    }}
                  >
                    {variant.looseOwned ? 'Loose ✓' : 'Loose'}
                  </Button>

                  <Button
                    variant={variant.wishlisted ? 'default' : 'outline'}
                    className="w-full"
                    onClick={async () => {
                      if (!variantId) return;
                      try {
                        await fetch(`/api/variants/${variantId}/toggle-wish`, {
                          method: 'POST',
                        });
                        await refreshVariantAndModelData();
                      } catch (error) {
                        console.error('Error toggling wish:', error);
                      }
                    }}
                  >
                    {variant.wishlisted ? 'Wish ✓' : 'Wish'}
                  </Button>
                </div>

                {/* Refresh button to reload data after actions */}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (variantId) {
                        setLoading(true);
                        fetch(`/api/variants/${variantId}`)
                          .then((res) => res.json())
                          .then((data) => {
                            setVariant(data);
                            setLoading(false);
                            
                            // Refresh model data
                            if (data?.model?.id) {
                              fetch(`/api/models/${data.model.id}`)
                                .then((res) => res.json())
                                .then((modelRes) => {
                                  setModelData({
                                    id: modelRes.id,
                                    notes: modelRes.notes,
                                    packedPurchasePrice: modelRes.packedPurchasePrice,
                                    packedMarketPrice: modelRes.packedMarketPrice,
                                    loosePurchasePrice: modelRes.loosePurchasePrice,
                                    looseMarketPrice: modelRes.looseMarketPrice,
                                  });
                                })
                                .catch((err) => {
                                  console.error('Error fetching model data:', err);
                                });
                            }
                          })
                          .catch((err) => {
                            console.error('Error fetching variant:', err);
                            setLoading(false);
                          });
                      }
                    }}
                  >
                    Verileri Yenile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>

      {/* Image Search Dialog */}
      {model?.id && getModelDataForSearch() && (
        <ImageSearchDialog
          open={isImageSearchOpen}
          onOpenChange={setIsImageSearchOpen}
          modelId={model.id}
          modelData={getModelDataForSearch()!}
        />
      )}
    </Dialog>
  );
}


