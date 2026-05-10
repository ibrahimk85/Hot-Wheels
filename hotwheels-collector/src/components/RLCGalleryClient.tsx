'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link2, Unlink, Loader2 } from 'lucide-react';

interface GalleryImage {
  id: number;
  path: string;
  alt: string | null;
  name: string | null;
  modelId: number | null;
  model: {
    id: number;
    castingName: string;
    collection: {
      name: string;
      year: {
        year: number;
      };
    };
    subSeries: {
      id: number;
      name: string;
    } | null;
  } | null;
}

interface CollectionData {
  id: number;
  name: string;
  year: {
    year: number;
  };
  subSeries: {
    id: number;
    name: string;
    models: Array<{
      id: number;
      castingName: string;
      saleDate: string | null;
    }>;
  }[];
}

interface RLCGalleryClientProps {
  galleryImages: GalleryImage[];
  collectionsByYear: Array<{
    year: number;
    collections: CollectionData[];
  }>;
}

export function RLCGalleryClient({
  galleryImages,
  collectionsByYear,
}: RLCGalleryClientProps) {
  const [selectedYear, setSelectedYear] = useState<string>(''); // For filtering images
  const [selectedYearForLink, setSelectedYearForLink] = useState<string>(''); // For linking dropdown
  const [selectedSubSeries, setSelectedSubSeries] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [linkingImageId, setLinkingImageId] = useState<number | null>(null);
  const [unlinkingImageId, setUnlinkingImageId] = useState<number | null>(null);
  const [images, setImages] = useState<GalleryImage[]>(galleryImages);
  const [selectedImageForPopup, setSelectedImageForPopup] = useState<GalleryImage | null>(null);

  // Get available years
  const availableYears = useMemo(() => {
    return collectionsByYear.map(({ year }) => year).sort((a, b) => b - a);
  }, [collectionsByYear]);

  // Get sub-series for selected year (for linking)
  const availableSubSeries = useMemo(() => {
    if (!selectedYearForLink) return [];
    const yearData = collectionsByYear.find(
      ({ year }) => year.toString() === selectedYearForLink
    );
    if (!yearData) return [];
    
    const allSubSeries: Array<{ id: number; name: string; collectionId: number }> = [];
    yearData.collections.forEach((collection) => {
      collection.subSeries.forEach((subSeries) => {
        allSubSeries.push({
          id: subSeries.id,
          name: subSeries.name,
          collectionId: collection.id,
        });
      });
    });
    return allSubSeries;
  }, [selectedYearForLink, collectionsByYear]);

  // Get models for selected sub-series
  const availableModels = useMemo(() => {
    if (!selectedSubSeries) return [];
    const subSeriesId = Number(selectedSubSeries);
    const yearData = collectionsByYear.find(
      ({ year }) => year.toString() === selectedYearForLink
    );
    if (!yearData) return [];
    
    for (const collection of yearData.collections) {
      const subSeries = collection.subSeries.find((ss) => ss.id === subSeriesId);
      if (subSeries) {
        return subSeries.models;
      }
    }
    return [];
  }, [selectedSubSeries, selectedYear, collectionsByYear]);

  const handleLinkImage = async (imageId: number) => {
    if (!selectedModel || selectedModel === '') {
      alert('Lütfen bir model seçin');
      return;
    }

    const modelIdNum = Number(selectedModel);
    if (Number.isNaN(modelIdNum) || modelIdNum <= 0) {
      alert('Geçersiz model seçimi');
      return;
    }

    setLinkingImageId(imageId);
    try {
      console.log('Linking image:', { imageId, modelId: modelIdNum, selectedModel });
      const response = await fetch(`/api/gallery/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
          modelId: modelIdNum,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Link error response:', error);
        throw new Error(error.error || 'Bağlama işlemi başarısız');
      }

      const updatedImage = await response.json();
      console.log('Image linked successfully:', updatedImage);
      
      // Update local state
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? updatedImage : img))
      );

      // Reset linking selections
      setSelectedYearForLink('');
      setSelectedSubSeries('');
      setSelectedModel('');
    } catch (error) {
      console.error('Error linking image:', error);
      alert(error instanceof Error ? error.message : 'Bağlama işlemi başarısız');
    } finally {
      setLinkingImageId(null);
    }
  };

  const handleUnlinkImage = async (imageId: number) => {
    if (!confirm('Bu resmi modelden ayırmak istediğinizden emin misiniz?')) {
      return;
    }

    setUnlinkingImageId(imageId);
    try {
      const response = await fetch(`/api/gallery/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ayırma işlemi başarısız');
      }

      const updatedImage = await response.json();
      
      // Update local state
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? updatedImage : img))
      );
    } catch (error) {
      console.error('Error unlinking image:', error);
      alert(error instanceof Error ? error.message : 'Ayırma işlemi başarısız');
    } finally {
      setUnlinkingImageId(null);
    }
  };

  // Extract filename from path
  const getFileName = (path: string): string => {
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    return parts[parts.length - 1] || path;
  };

  // Extract year from image path/filename
  // Format: {YIL}-{isim}.jpg or path contains /{YIL}/rlc/gallery/
  const getYearFromImage = (img: GalleryImage): number | null => {
    // Try to extract from path first (e.g., /images/hotwheels/2023/rlc/gallery/...)
    const pathMatch = img.path.match(/\/(\d{4})\/rlc\/gallery\//);
    if (pathMatch) {
      return parseInt(pathMatch[1], 10);
    }
    
    // Try to extract from filename (format: {YIL}-{name}.jpg)
    const fileName = getFileName(img.path);
    const fileNameMatch = fileName.match(/^(\d{4})-/);
    if (fileNameMatch) {
      return parseInt(fileNameMatch[1], 10);
    }
    
    // If linked to a model, use model's collection year
    if (img.model?.collection?.year) {
      return img.model.collection.year.year;
    }
    
    return null;
  };

  // Filter images by selected year
  const filteredImages = useMemo(() => {
    if (!selectedYear || selectedYear === '') {
      return images;
    }
    
    const selectedYearNum = parseInt(selectedYear, 10);
    if (isNaN(selectedYearNum)) {
      return images;
    }
    
    return images.filter((img) => {
      const imageYear = getYearFromImage(img);
      return imageYear === selectedYearNum;
    });
  }, [images, selectedYear]);

  // Normalize image path for display
  const normalizeImagePath = (path: string): string => {
    let normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized.replace(/\/+/g, '/');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Red Line Club Gallery</h2>
        <div className="text-sm text-muted-foreground">
          {filteredImages.length} resim {selectedYear ? `(${selectedYear})` : ''}
        </div>
      </div>

      {/* Filter and Linking Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Year Filter */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Yıl Filtresi</label>
              <Select value={selectedYear || undefined} onValueChange={(value) => {
                setSelectedYear(value || '');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm yıllar" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year.toString()} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linking Controls */}
            <div>
              <div className="text-sm font-semibold mb-2">Resmi Modele Bağla</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Yıl
                </label>
                <Select value={selectedYearForLink} onValueChange={(value) => {
                  setSelectedYearForLink(value);
                  setSelectedSubSeries('');
                  setSelectedModel('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Yıl seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year.toString()} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Alt Seri
                </label>
                <Select
                  value={selectedSubSeries}
                  onValueChange={(value) => {
                    setSelectedSubSeries(value);
                    setSelectedModel('');
                  }}
                  disabled={!selectedYearForLink}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alt seri seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubSeries.map((subSeries) => (
                      <SelectItem
                        key={subSeries.id.toString()}
                        value={subSeries.id.toString()}
                      >
                        {subSeries.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Model
                </label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={!selectedSubSeries}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Model seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem
                        key={model.id.toString()}
                        value={model.id.toString()}
                      >
                        {model.castingName}
                        {model.saleDate && ` (${model.saleDate})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
            </div>
        </CardContent>
      </Card>

      {/* Gallery Images */}
      {filteredImages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {selectedYear ? `${selectedYear} yılı için gallery resmi bulunmamaktadır.` : 'Henüz gallery resmi bulunmamaktadır.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredImages.map((image) => {
            const isLinked = image.modelId !== null;
            const isLinking = linkingImageId === image.id;
            const isUnlinking = unlinkingImageId === image.id;

            return (
              <Card key={image.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div 
                    className="relative w-full h-48 bg-muted rounded-md overflow-hidden cursor-pointer"
                    onClick={() => setSelectedImageForPopup(image)}
                  >
                    <Image
                      src={normalizeImagePath(image.path)}
                      alt={image.alt || image.name || 'Gallery image'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-contain"
                    />
                  </div>

                  <div className="space-y-2">
                    {image.name && (
                      <div className="font-semibold text-sm">{image.name}</div>
                    )}

                    {isLinked && image.model && (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="w-full justify-center">
                          Bağlandı
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          <div className="font-medium">{image.model.castingName}</div>
                          <div>
                            {image.model.collection.year.year}{' '}
                            – {image.model.subSeries?.name || 'N/A'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Display filename */}
                    <div className="text-xs text-muted-foreground break-all">
                      {getFileName(image.path)}
                    </div>

                    <div className="flex gap-2">
                      {isLinked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleUnlinkImage(image.id)}
                          disabled={isUnlinking}
                        >
                          {isUnlinking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Unlink className="h-4 w-4 mr-1" />
                              Ayır
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleLinkImage(image.id)}
                          disabled={isLinking || !selectedModel}
                        >
                          {isLinking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Link2 className="h-4 w-4 mr-1" />
                              Bağla
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Image Popup Dialog */}
      <Dialog open={selectedImageForPopup !== null} onOpenChange={(open) => {
        if (!open) setSelectedImageForPopup(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedImageForPopup?.name || 
               (selectedImageForPopup?.model?.castingName) || 
               'Gallery Image'}
            </DialogTitle>
          </DialogHeader>
          {selectedImageForPopup && (
            <div className="space-y-4">
              <div className="relative w-full h-[70vh] bg-muted rounded-lg overflow-hidden">
                <Image
                  src={normalizeImagePath(selectedImageForPopup.path)}
                  alt={selectedImageForPopup.alt || selectedImageForPopup.name || 'Gallery image'}
                  fill
                  sizes="90vw"
                  className="object-contain"
                  unoptimized
                />
              </div>
              
              <div className="space-y-2 text-sm">
                {selectedImageForPopup.name && (
                  <div>
                    <span className="font-semibold">İsim:</span>{' '}
                    {selectedImageForPopup.name}
                  </div>
                )}
                
                {selectedImageForPopup.model && (
                  <div>
                    <span className="font-semibold">Model:</span>{' '}
                    {selectedImageForPopup.model.castingName}
                    {selectedImageForPopup.model.collection && (
                      <span className="text-muted-foreground">
                        {' '}({selectedImageForPopup.model.collection.year.year}
                        {' '}– {selectedImageForPopup.model.subSeries?.name || 'N/A'})
                      </span>
                    )}
                  </div>
                )}
                
                <div>
                  <span className="font-semibold">Dosya Adı:</span>{' '}
                  <span className="font-mono text-xs break-all">
                    {getFileName(selectedImageForPopup.path)}
                  </span>
                </div>
                
                {selectedImageForPopup.alt && (
                  <div>
                    <span className="font-semibold">Alt Text:</span>{' '}
                    {selectedImageForPopup.alt}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



