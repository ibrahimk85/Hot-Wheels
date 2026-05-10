'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Star, Trash2, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRef, ChangeEvent } from 'react';

interface VariantImageGalleryProps {
  images: Array<{
    id: number;
    path: string;
    alt?: string | null;
  }>;
  castingName: string;
  modelId: number;
  mainImageId?: number | null;
  onImageUpdate?: () => void;
}

export function VariantImageGallery({
  images,
  castingName,
  modelId,
  mainImageId,
  onImageUpdate,
}: VariantImageGalleryProps) {
  const router = useRouter();
  const [settingMainImage, setSettingMainImage] = useState<number | null>(null);
  const [deletingImage, setDeletingImage] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageType, setImageType] = useState<'carded' | 'loose' | 'other'>('other');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const normalizePath = (path: string) => {
    let normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized.replace(/\/+/g, '/');
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);

      const response = await fetch(`/api/models/${modelId}/upload-image`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (onImageUpdate) {
          onImageUpdate();
        } else {
          router.refresh();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Görsel yüklenirken bir hata oluştu');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(`Görsel yüklenirken bir hata oluştu: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Separate carded/packed and loose images
  const cardedImages = images.filter((img) => {
    const path = img.path.toLowerCase();
    return path.includes('carded-') || path.includes('_carded') || path.includes('/carded') ||
           path.includes('packed');
  });
  const looseImages = images.filter((img) => {
    const path = img.path.toLowerCase();
    return path.includes('loose-') || path.includes('_loose') || path.includes('/loose') ||
           (path.includes('team-transport') && !path.includes('carded'));
  });

  // Combine: first carded image (if any), then all other images (loose and others)
  const seenIds = new Set<number>();
  const allImages: typeof images = [];
  
  if (cardedImages.length > 0) {
    const firstCarded = cardedImages[0];
    if (!seenIds.has(firstCarded.id)) {
      allImages.push(firstCarded);
      seenIds.add(firstCarded.id);
    }
  }
  
  for (const img of looseImages) {
    if (!seenIds.has(img.id)) {
      allImages.push(img);
      seenIds.add(img.id);
    }
  }
  
  for (const img of images) {
    if (!seenIds.has(img.id)) {
      const path = img.path.toLowerCase();
      const isCarded = path.includes('carded-') || path.includes('_carded') || path.includes('/carded') ||
        path.includes('packed');
      const isLoose = path.includes('loose-') || path.includes('_loose') || path.includes('/loose');
      
      if (!isCarded && !isLoose) {
        allImages.push(img);
        seenIds.add(img.id);
      }
    }
  }
  
  if (allImages.length === 0) {
    for (const img of images) {
      if (!seenIds.has(img.id)) {
        allImages.push(img);
        seenIds.add(img.id);
      }
    }
  }

  const currentImage = allImages[currentImageIndex];

  if (!currentImage && images.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Görsel yok</span>
        </div>
        
        {/* Upload section when no images */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Label htmlFor="imageType" className="text-sm font-semibold">
              Görsel Türü:
            </Label>
            <Select
              value={imageType}
              onValueChange={(value: 'carded' | 'loose' | 'other') =>
                setImageType(value)
              }
            >
              <SelectTrigger id="imageType" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carded">Carded</SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
                <SelectItem value="other">Diğer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload-input"
          />
          <Button
            type="button"
            onClick={handleFileSelect}
            disabled={uploading}
            variant="outline"
            className="w-full gap-2"
            size="sm"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Yükleniyor...' : 'Yeni Görsel Ekle'}
          </Button>
        </div>
      </div>
    );
  }

  const handleSetMainImage = async (imageId: number) => {
    setSettingMainImage(imageId);
    try {
      const formData = new FormData();
      formData.append('imageId', imageId.toString());

      const response = await fetch(`/api/models/${modelId}/set-main-image`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        if (onImageUpdate) {
          onImageUpdate();
        } else {
          router.refresh();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Ana görsel ayarlanırken bir hata oluştu');
      }
    } catch (error) {
      console.error('Error setting main image:', error);
      alert('Ana görsel ayarlanırken bir hata oluştu');
    } finally {
      setSettingMainImage(null);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Bu görseli silmek istediğinizden emin misiniz?')) {
      return;
    }

    setDeletingImage(imageId);
    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (onImageUpdate) {
          onImageUpdate();
        } else {
          router.refresh();
        }
        // Reset to first image if current was deleted
        if (currentImageIndex >= allImages.length - 1) {
          setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Görsel silinirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Görsel silinirken bir hata oluştu');
    } finally {
      setDeletingImage(null);
    }
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="relative w-full h-80 bg-transparent rounded-lg overflow-hidden group">
        {currentImage && (
          <>
            <Image
              src={normalizePath(currentImage.path)}
              alt={currentImage.alt || castingName}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
              unoptimized
            />
            
            {/* Navigation arrows */}
            {allImages.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/50 hover:bg-black/70"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-4 w-4 text-white" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/50 hover:bg-black/70"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-4 w-4 text-white" />
                </Button>
              </>
            )}
            
            {/* Delete button */}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={() => handleDeleteImage(currentImage.id)}
              disabled={deletingImage === currentImage.id}
              title="Görseli Sil"
            >
              {deletingImage === currentImage.id ? (
                <span className="text-xs">...</span>
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allImages.map((img, index) => {
            const path = img.path.toLowerCase();
            const isCarded = path.includes('carded-') || path.includes('_carded') || 
              path.includes('/carded') || path.includes('packed');
            const isLoose = path.includes('loose-') || path.includes('_loose') || 
              path.includes('/loose');
            
            let label = isCarded ? 'Carded' : isLoose ? 'Loose' : `Resim ${index + 1}`;
            if (isLoose) {
              const match = img.path.match(/loose-[^-]+-[^-]+-(.+?)\./);
              if (match) {
                const suffix = match[1];
                if (suffix === 'transport') {
                  label = 'Transport Loose';
                } else if (suffix.startsWith('car')) {
                  label = `Car ${suffix.replace('car', '')} Loose`;
                }
              }
            }
            const isActive = index === currentImageIndex;
            const isMain = mainImageId === img.id;

            return (
              <button
                key={img.id}
                onClick={() => setCurrentImageIndex(index)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${
                  isActive
                    ? 'border-primary ring-2 ring-primary'
                    : 'border-muted hover:border-primary/50'
                }`}
                title={label}
              >
                <Image
                  src={normalizePath(img.path)}
                  alt={img.alt || `${label} thumbnail`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
                {isMain && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Image Switcher Buttons */}
      {allImages.length > 1 && (
        <div className="flex gap-2 justify-center flex-wrap">
          {allImages.map((img, index) => {
            const path = img.path.toLowerCase();
            const isCarded = path.includes('carded-') || path.includes('_carded') || 
              path.includes('/carded') || path.includes('packed');
            const isLoose = path.includes('loose-') || path.includes('_loose') || 
              path.includes('/loose');
            
            let label = isCarded ? 'Carded' : isLoose ? 'Loose' : `Resim ${index + 1}`;
            if (isLoose) {
              const match = img.path.match(/loose-[^-]+-[^-]+-(.+?)\./);
              if (match) {
                const suffix = match[1];
                if (suffix === 'transport') {
                  label = 'Transport Loose';
                } else if (suffix.startsWith('car')) {
                  label = `Car ${suffix.replace('car', '')} Loose`;
                }
              }
            }
            const isActive = index === currentImageIndex;

            return (
              <button
                key={img.id}
                onClick={() => setCurrentImageIndex(index)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-4 border-t">
        {/* Set as Main Image Button */}
        {currentImage && (
          <div className="flex justify-center">
            <Button
              onClick={() => handleSetMainImage(currentImage.id)}
              disabled={settingMainImage === currentImage.id || mainImageId === currentImage.id}
              variant={mainImageId === currentImage.id ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
            >
              <Star className={`h-4 w-4 ${mainImageId === currentImage.id ? 'fill-current' : ''}`} />
              {settingMainImage === currentImage.id
                ? 'Ayarlanıyor...'
                : mainImageId === currentImage.id
                ? 'Ana Görsel'
                : 'Ana Görsel Yap'}
            </Button>
          </div>
        )}

        {/* Upload New Image */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="imageType" className="text-sm font-semibold">
              Görsel Türü:
            </Label>
            <Select
              value={imageType}
              onValueChange={(value: 'carded' | 'loose' | 'other') =>
                setImageType(value)
              }
            >
              <SelectTrigger id="imageType" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carded">Carded</SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
                <SelectItem value="other">Diğer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload-input"
          />
          <Button
            type="button"
            onClick={handleFileSelect}
            disabled={uploading}
            variant="outline"
            className="w-full gap-2"
            size="sm"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Yükleniyor...' : 'Yeni Görsel Ekle'}
          </Button>
        </div>
      </div>
    </div>
  );
}
