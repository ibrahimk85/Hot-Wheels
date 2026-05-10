'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModelImageGallery } from './ModelImageGallery';
import { collectionUsesVariantLevelPreviewImages } from '@/lib/variant-preview-image';
import { filterOutWikiPlaceholderImages } from '@/lib/wiki-image-placeholder';

interface ModelDetailModalProps {
  modelId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ModelData {
  id: number;
  castingName: string;
  castingId: string | null;
  description: string | null;
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
  mainImageId: number | null;
  owned: boolean;
  wishlisted: boolean;
  quantity: number;
  notes: string | null;
  packedPrice: number | null;
  loosePrice: number | null;
  packedPurchasePrice: number | null;
  packedMarketPrice: number | null;
  packedOriginalPrice: number | null;
  loosePurchasePrice: number | null;
  looseMarketPrice: number | null;
  images: Array<{
    id: number;
    path: string;
    alt: string | null;
  }>;
  variants?: Array<{
    id: number;
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
      year: {
        id: number;
        year: number;
      };
    };
  } | null;
}

export function ModelDetailModal({
  modelId,
  isOpen,
  onClose,
}: ModelDetailModalProps) {
  const router = useRouter();
  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [packedPrice, setPackedPrice] = useState('');
  const [loosePrice, setLoosePrice] = useState('');
  const [packedPurchasePrice, setPackedPurchasePrice] = useState('');
  const [packedMarketPrice, setPackedMarketPrice] = useState('');
  const [packedOriginalPrice, setPackedOriginalPrice] = useState('');
  const [loosePurchasePrice, setLoosePurchasePrice] = useState('');
  const [looseMarketPrice, setLooseMarketPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && modelId) {
      setLoading(true);
      // Fetch model details
      fetch(`/api/models/${modelId}`)
        .then((res) => res.json())
        .then((data) => {
          setModel(data);
          setNotes(data.notes || '');
          setPackedPrice(data.packedPrice?.toString() || '');
          setLoosePrice(data.loosePrice?.toString() || '');
          setPackedPurchasePrice(data.packedPurchasePrice?.toString() || '');
          setPackedMarketPrice(data.packedMarketPrice?.toString() || '');
          setPackedOriginalPrice(data.packedOriginalPrice?.toString() || '');
          setLoosePurchasePrice(data.loosePurchasePrice?.toString() || '');
          setLooseMarketPrice(data.looseMarketPrice?.toString() || '');
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching model:', err);
          setLoading(false);
        });
    } else {
      setModel(null);
    }
  }, [isOpen, modelId]);

  if (!modelId) return null;

  const subSeries = model?.subSeries;
  const collection = subSeries?.collection;
  
  // For Team Transport and Elite 64: Collect Photo Carded (main image) + all loose images from variants
  let images: Array<{ id: number; path: string; alt: string | null }> = [];
  
  // Debug: Log model images
  if (model) {
    console.log('Model images in render:', model.images);
  }
  
  if (collection?.name === 'Team Transport' || collection?.name === 'Elite 64') {
    // For Elite 64: Get carded/packed image first, then loose images
    if (collection?.name === 'Elite 64') {
      // Get carded/packed image from model images (main image)
      let cardedImage: { id: number; path: string; alt: string | null } | undefined;
      
      // First try to get by mainImageId
      if (model?.mainImageId) {
        // Check model images first
        cardedImage = model.images?.find(img => img.id === model.mainImageId);
        
        // If not found in model images, check variant images
        if (!cardedImage && model?.variants) {
          for (const variant of model.variants) {
            if (variant.images) {
              const found = variant.images.find(img => img.id === model.mainImageId);
              if (found) {
                cardedImage = found;
                break;
              }
            }
          }
        }
      }
      
      // If not found, try to find carded/packed image by path
      if (!cardedImage) {
        cardedImage = model?.images?.find(img => {
          const path = img.path.toLowerCase();
          return path.includes('carded-') || path.includes('packed-');
        });
      }
      
      if (cardedImage) {
        images.push(cardedImage);
      }
      
      // Add all other model images (not already added as carded)
      if (model?.images) {
        for (const img of model.images) {
          // Skip if already added as carded image
          if (cardedImage && img.id === cardedImage.id) {
            continue;
          }
          // Add all model images (including newly uploaded ones)
          if (!images.find(i => i.id === img.id)) {
            images.push(img);
          }
        }
      }
      
      // Get all loose images from all variants
      if (model?.variants && model.variants.length > 0) {
        const looseImages: Array<{ id: number; path: string; alt: string | null }> = [];
        for (const variant of model.variants) {
          if (variant.images && variant.images.length > 0) {
            for (const img of variant.images) {
              const path = img.path.toLowerCase();
              // Only add loose images
              if (path.includes('loose-')) {
                // Check if already added (avoid duplicates)
                if (!looseImages.find(i => i.path === img.path)) {
                  looseImages.push(img);
                }
              }
            }
          }
        }
        images.push(...looseImages);
      }
    } else if (collection?.name === 'Team Transport') {
      // Get main image (Photo Carded) from model images
      // First try to find carded image in model.images
      const cardedImage = model?.images?.find(img => {
        const path = img.path.toLowerCase();
        return path.includes('carded-') || path.includes('_carded') || path.includes('/carded');
      });
      
      if (cardedImage) {
        images.push(cardedImage);
      }
      
      // Get all loose images from all variants
      if (model?.variants && model.variants.length > 0) {
        const looseImages: Array<{ id: number; path: string; alt: string | null }> = [];
        for (const variant of model.variants) {
          if (variant.images && variant.images.length > 0) {
            for (const img of variant.images) {
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
        images.push(...looseImages);
      }
      
      // If no images found yet, fallback to model images
      if (images.length === 0) {
        images = model?.images || [];
      }
    }
  } else {
    // For other collections: prioritize model images, fallback to variant images
    images = model?.images || [];
    
    // If no model images, try to get from variants
    if (images.length === 0 && model?.variants && model.variants.length > 0) {
      // Collect all variant images
      const variantImages: Array<{ id: number; path: string; alt: string | null }> = [];
      for (const variant of model.variants) {
        if (variant.images && variant.images.length > 0) {
          variantImages.push(...variant.images);
        }
      }
      
      // Boulevard / F&F Premium / etc.: prefer carded + loose; omit wiki placeholder files
      if (collectionUsesVariantLevelPreviewImages(collection?.name)) {
        const clean = filterOutWikiPlaceholderImages(variantImages);
        const pool = clean.length > 0 ? clean : variantImages;
        const cardedImg = pool.find(img => 
          img.path.includes('_carded') || 
          img.path.includes('carded') ||
          img.path.toLowerCase().includes('packed')
        );
        const looseImg = pool.find(img => 
          img.path.includes('_loose') || 
          img.path.includes('loose')
        );
        
        if (cardedImg && looseImg) {
          images = [cardedImg, looseImg];
        } else {
          images = pool;
        }
      } else {
        // For Mainline and others, use all variant images (or first one)
        images = variantImages.length > 0 ? variantImages : [];
      }
    }
  }

  images = filterOutWikiPlaceholderImages(images);

  const handleClose = () => {
    onClose();
    // Refresh the page after modal closes to update any changes
    router.refresh();
  };

  const handleSaveNotes = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('id', modelId.toString());
      formData.append('notes', notes);

      const response = await fetch('/api/models/update-notes', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Refresh model data
        const updatedModel = await fetch(`/api/models/${modelId}`).then((res) =>
          res.json()
        );
        setModel(updatedModel);
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrice = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('id', modelId.toString());
      formData.append('packedPrice', packedPrice || '');
      formData.append('loosePrice', loosePrice || '');
      formData.append('packedPurchasePrice', packedPurchasePrice || '');
      formData.append('packedMarketPrice', packedMarketPrice || '');
      formData.append('packedOriginalPrice', packedOriginalPrice || '');
      formData.append('loosePurchasePrice', loosePurchasePrice || '');
      formData.append('looseMarketPrice', looseMarketPrice || '');

      const response = await fetch('/api/models/update-price', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Refresh model data
        const updatedModel = await fetch(`/api/models/${modelId}`).then((res) =>
          res.json()
        );
        setModel(updatedModel);
        setPackedPrice(updatedModel.packedPrice?.toString() || '');
        setLoosePrice(updatedModel.loosePrice?.toString() || '');
        setPackedPurchasePrice(updatedModel.packedPurchasePrice?.toString() || '');
        setPackedMarketPrice(updatedModel.packedMarketPrice?.toString() || '');
        setPackedOriginalPrice(updatedModel.packedOriginalPrice?.toString() || '');
        setLoosePurchasePrice(updatedModel.loosePurchasePrice?.toString() || '');
        setLooseMarketPrice(updatedModel.looseMarketPrice?.toString() || '');
      }
    } catch (err) {
      console.error('Error saving price:', err);
    } finally {
      setSaving(false);
    }
  };

  const refreshModelData = async () => {
    if (!modelId) return;
    try {
      const updatedModel = await fetch(`/api/models/${modelId}`).then((res) =>
        res.json()
      );
      console.log('Refreshed model data:', updatedModel);
      console.log('Model images count:', updatedModel.images?.length || 0);
      console.log('Model images:', updatedModel.images);
      setModel(updatedModel);
    } catch (err) {
      console.error('Error refreshing model data:', err);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {loading ? 'Yükleniyor...' : model?.castingName ?? 'Model Detayı'}
          </DialogTitle>
          <DialogDescription>
            Model bilgilerini görüntüleyin ve düzenleyin
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <span className="text-sm text-muted-foreground">Yükleniyor...</span>
          </div>
        )}

        {!loading && model && (
          <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
            {/* Görsel */}
            <Card>
              <CardContent className="p-6 space-y-4">
                {images.length > 0 ? (
                  <ModelImageGallery
                    images={images}
                    castingName={model.castingName ?? 'Hot Wheels'}
                    modelId={modelId}
                    mainImageId={model.mainImageId}
                    onImageUpdate={refreshModelData}
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
                    <span>{model.castingName ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Toy #:
                    </span>{' '}
                    <span>{model.castingId ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Casting #:
                    </span>{' '}
                    <span>{model.castingNumber ?? '—'}</span>
                  </div>
                  {collection && (
                    <>
                      <div>
                        <span className="font-semibold text-muted-foreground">
                          Yıl:
                        </span>{' '}
                        <span>{collection.year.year ?? '—'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">
                          Seri:
                        </span>{' '}
                        <span>{collection.name ?? '—'}</span>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Alt Seri:
                    </span>{' '}
                    <span>{subSeries?.name ?? '—'}</span>
                  </div>
                  {model.debutSeries && (
                    <div>
                      <span className="font-semibold text-muted-foreground">
                        İlk Seri:
                      </span>{' '}
                      <span>{model.debutSeries}</span>
                    </div>
                  )}
                  {model.produced && (
                    <div>
                      <span className="font-semibold text-muted-foreground">
                        Üretim:
                      </span>{' '}
                      <span>{model.produced}</span>
                    </div>
                  )}
                  {model.designer && (
                    <div>
                      <span className="font-semibold text-muted-foreground">
                        Tasarımcı:
                      </span>{' '}
                      <span>{model.designer}</span>
                    </div>
                  )}
                </div>

                {/* Açıklama */}
                {model.description && (
                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-2">Açıklama:</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {(() => {
                        // Parse description to extract Sale Date and Quantity
                        const description = model.description;
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

                {/* Notlar - Sadece bilgi olarak göster (düzenlenemez) */}
                <div className="pt-2 border-t">
                  <div className="font-semibold text-sm mb-2">Notlar:</div>
                  {model.notes ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{model.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not yok</p>
                  )}
                </div>

                {/* Fiyat - Sadece bilgi olarak göster (düzenlenemez) */}
                <div className="pt-2 border-t">
                  <div className="font-semibold text-sm mb-2">Fiyat:</div>
                  {(model.packedPurchasePrice || model.packedMarketPrice || model.packedOriginalPrice || model.loosePurchasePrice || model.looseMarketPrice) ? (
                    <div className="space-y-3 text-sm">
                      {/* Packed Fiyatlar */}
                      {(model.packedPurchasePrice || model.packedMarketPrice || model.packedOriginalPrice) && (
                        <div className="space-y-1">
                          <div className="font-semibold text-xs">Packed (Kutusunda)</div>
                          {model.packedPurchasePrice && (
                            <div className="text-muted-foreground">
                              <span className="text-xs">Alınan Fiyat: </span>
                              <span>{model.packedPurchasePrice ? `${model.packedPurchasePrice.toFixed(2)} €` : '-'}</span>
                            </div>
                          )}
                          {model.packedMarketPrice && (
                            <div className="text-muted-foreground">
                              <span className="text-xs">Piyasa Değeri: </span>
                              <span>{model.packedMarketPrice ? `${model.packedMarketPrice.toFixed(2)} €` : '-'}</span>
                            </div>
                          )}
                          {model.packedOriginalPrice && (
                            <div className="text-muted-foreground">
                              <span className="text-xs">Orjinal Fiyat: </span>
                              <span>{model.packedOriginalPrice ? `${model.packedOriginalPrice.toFixed(2)} €` : '-'}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Loose Fiyatlar */}
                      {(model.loosePurchasePrice || model.looseMarketPrice) && (
                        <div className="space-y-1">
                          <div className="font-semibold text-xs">Loose (Kutusuz)</div>
                          {model.loosePurchasePrice && (
                            <div className="text-muted-foreground">
                              <span className="text-xs">Alınan Fiyat: </span>
                              <span>{model.loosePurchasePrice ? `${model.loosePurchasePrice.toFixed(2)} €` : '-'}</span>
                            </div>
                          )}
                          {model.looseMarketPrice && (
                            <div className="text-muted-foreground">
                              <span className="text-xs">Piyasa Değeri: </span>
                              <span>{model.looseMarketPrice ? `${model.looseMarketPrice.toFixed(2)} €` : '-'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Fiyat bilgisi yok</p>
                  )}
                </div>


                {/* Status badges */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {model.owned && (
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                      Sende var
                    </span>
                  )}
                  {model.wishlisted && (
                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs">
                      Wishlist'te
                    </span>
                  )}
                  {typeof model.quantity === 'number' && model.quantity > 1 && (
                    <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">
                      {model.quantity} adet
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

