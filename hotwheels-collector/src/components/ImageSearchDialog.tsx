'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, Loader2, Check, ExternalLink, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImageResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  width: number;
  height: number;
  contextLink: string;
}

interface ImageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: number;
  modelData: {
    castingName: string;
    year?: number;
    collectionName?: string;
    toyNumber?: string;
    cardNumber?: string;
  };
}

export function ImageSearchDialog({
  open,
  onOpenChange,
  modelId,
  modelData,
}: ImageSearchDialogProps) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [query, setQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Reset state when dialog opens or closes
  useEffect(() => {
    if (!open) {
      // Clear state when dialog closes
      setImages([]);
      setQuery('');
      setSelectedImageUrl(null);
      setError(null);
      setSearching(false);
      setSaving(null);
    } else {
      // Clear state when dialog opens (for fresh search)
      setImages([]);
      setQuery('');
      setSelectedImageUrl(null);
      setError(null);
      setSearching(false);
      setSaving(null);
    }
  }, [open]);

  const handleSearch = async (forceRefresh: boolean = false) => {
    console.log('[CLIENT] Starting image search:', { modelId, forceRefresh, modelData });
    setSearching(true);
    setError(null);
    setImages([]);
    setQuery('');

    try {
      const response = await fetch('/api/image-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId, forceRefresh }),
      });

      console.log('[CLIENT] Response status:', response.status);
      const data = await response.json();
      console.log('[CLIENT] Response data:', { 
        success: data.success, 
        query: data.query, 
        resultsCount: data.results?.length || 0 
      });

      if (!response.ok) {
        console.error('[CLIENT] API error:', data);
        if (data.requiresSetup) {
          setError(
            'API anahtarları yapılandırılmamış. Lütfen Ayarlar sayfasından Gemini API ve Google Search API anahtarlarını yapılandırın.'
          );
        } else {
          setError(data.message || data.error || 'Resim arama başarısız oldu.');
        }
        return;
      }

      const results = data.results || [];
      console.log('[CLIENT] Setting results:', results.length);
      
      setImages(results);
      setQuery(data.query || '');
      
      if (results.length === 0) {
        console.warn('[CLIENT] No results found for query:', data.query);
        setError('Arama sonucu bulunamadı. Lütfen "Tekrar Ara" butonunu kullanarak tekrar deneyin.');
      } else {
        setError(null); // Clear any previous errors if we have results
      }
    } catch (err) {
      setError('Resim arama sırasında bir hata oluştu.');
      console.error('Error searching images:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleClearResults = () => {
    setImages([]);
    setQuery('');
    setSelectedImageUrl(null);
    setError(null);
  };

  const handleSaveImage = async (imageUrl: string) => {
    setSaving(imageUrl);
    setError(null);

    try {
      console.log('Saving image:', { modelId, imageUrl });
      const response = await fetch('/api/image-search/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId, imageUrl }),
      });

      const data = await response.json();
      console.log('[CLIENT] Save response status:', response.status);
      console.log('[CLIENT] Save response data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
            const errorMessage = data.error || data.message || 'Resim kaydedilemedi.';
            const errorDetails = data.details || '';
            console.error('[CLIENT] Save failed:', errorMessage, errorDetails);
            console.error('[CLIENT] Full error response:', data);
            
            // Show user-friendly error message
            let userMessage = errorMessage;
            if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('erişim engellendi')) {
              userMessage = 'Bu resim hotlink koruması nedeniyle indirilemiyor. Lütfen farklı bir resim seçin veya resmi bilgisayarınıza indirip "Yeni Görsel Ekle" butonunu kullanarak yükleyin.';
            }
            
            setError(`${userMessage}${errorDetails ? `\n\nDetaylar: ${errorDetails.substring(0, 200)}` : ''}`);
            setSaving(null);
            return;
          }

      // Success - show success message and refresh
      console.log('[CLIENT] ✅ Image save successful!', data);
      console.log('[CLIENT] Image data:', data.image);
      
      setSelectedImageUrl(imageUrl);
      setError(null);
      
      // Show success message briefly
      const successMessage = data.message || 'Resim başarıyla kaydedildi!';
      console.log('[CLIENT] Success message:', successMessage);
      console.log('[CLIENT] Image ID:', data.image?.id);
      console.log('[CLIENT] Image path:', data.image?.path);
      
      // Close dialog first
      onOpenChange(false);
      
      // Refresh the page to show the new image
      // Use window.location.reload() for a full page refresh to ensure images are updated
      setTimeout(() => {
        console.log('[CLIENT] Reloading page...');
        window.location.reload();
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Resim kaydetme sırasında bir hata oluştu.';
      console.error('Error saving image:', err);
      setError(errorMessage);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resim Ara - {modelData.castingName}</DialogTitle>
          <DialogDescription>
            {modelData.year && `Yıl: ${modelData.year} • `}
            {modelData.collectionName && `Koleksiyon: ${modelData.collectionName} • `}
            {modelData.toyNumber && `Toy#: ${modelData.toyNumber}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {saving && selectedImageUrl && !error && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Resim başarıyla kaydedildi! Sayfa yenileniyor...
              </AlertDescription>
            </Alert>
          )}

          {!images.length && !searching && !error && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">
                Bu model için resim aramak istiyor musunuz?
              </p>
              <Button onClick={() => handleSearch(false)} disabled={searching}>
                <Search className="mr-2 h-4 w-4" />
                Resim Ara
              </Button>
            </div>
          )}

          {!images.length && !searching && error && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">
                Arama sonucu bulunamadı. Tekrar denemek ister misiniz?
              </p>
              <Button onClick={() => handleSearch(true)} disabled={searching}>
                <Search className="mr-2 h-4 w-4" />
                Tekrar Ara
              </Button>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Resimler aranıyor...</p>
            </div>
          )}

          {query && (
            <div className="text-sm text-muted-foreground">
              <strong>Arama sorgusu:</strong> {query}
            </div>
          )}

          {images.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Bulunan Resimler ({images.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearResults}
                    disabled={searching}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Sonuçları Temizle
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSearch(true)}
                    disabled={searching}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Tekrar Ara
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <Card
                    key={index}
                    className={`relative overflow-hidden cursor-pointer transition-all ${
                      selectedImageUrl === image.url
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="relative aspect-square">
                        <img
                          src={image.thumbnail}
                          alt={image.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {selectedImageUrl === image.url && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-8 w-8 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {image.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {image.width} × {image.height}
                          </span>
                          <a
                            href={image.contextLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleSaveImage(image.url)}
                          disabled={saving === image.url || saving !== null}
                        >
                          {saving === image.url ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Kaydediliyor...
                            </>
                          ) : (
                            'Seç ve Kaydet'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

