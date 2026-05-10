'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ModelImageGalleryProps {
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

export function ModelImageGallery({
  images,
  castingName,
  modelId,
  mainImageId,
  onImageUpdate,
}: ModelImageGalleryProps) {
  const router = useRouter();
  const [settingMainImage, setSettingMainImage] = useState<number | null>(null);
  const [deletingImage, setDeletingImage] = useState<number | null>(null);
  // Separate carded/packed and loose images
  // Support both naming conventions: "carded-" or "_carded" and "loose-" or "_loose"
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
  // Remove duplicates by ID to avoid React key conflicts
  const seenIds = new Set<number>();
  const allImages: typeof images = [];
  
  if (cardedImages.length > 0) {
    const firstCarded = cardedImages[0];
    if (!seenIds.has(firstCarded.id)) {
      allImages.push(firstCarded);
      seenIds.add(firstCarded.id);
    }
  }
  
  // Add loose images, skipping duplicates
  for (const img of looseImages) {
    if (!seenIds.has(img.id)) {
      allImages.push(img);
      seenIds.add(img.id);
    }
  }
  
  // Add all other images that are not carded or loose (including newly uploaded "other" type images)
  for (const img of images) {
    if (!seenIds.has(img.id)) {
      const path = img.path.toLowerCase();
      const isCarded = path.includes('carded-') || path.includes('_carded') || path.includes('/carded') ||
        path.includes('packed');
      const isLoose = path.includes('loose-') || path.includes('_loose') || path.includes('/loose');
      
      // If it's not carded or loose, it's an "other" type image - add it
      if (!isCarded && !isLoose) {
        allImages.push(img);
        seenIds.add(img.id);
      }
    }
  }
  
  // If no images found at all, use all images as-is (without duplicates)
  if (allImages.length === 0) {
    for (const img of images) {
      if (!seenIds.has(img.id)) {
        allImages.push(img);
        seenIds.add(img.id);
      }
    }
  }

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentImage = allImages[currentImageIndex];

  if (!currentImage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-muted-foreground">Görsel yok</span>
      </div>
    );
  }

  const normalizePath = (path: string) => {
    let normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized.replace(/\/+/g, '/');
  };

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
        // Refresh the modal data
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
        // Refresh the modal data
        if (onImageUpdate) {
          onImageUpdate();
        } else {
          router.refresh();
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

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative w-full h-80 bg-transparent rounded-lg overflow-hidden group">
        <Image
          src={normalizePath(currentImage.path)}
          alt={currentImage.alt || castingName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
          unoptimized
        />
        {/* Delete button - top right corner */}
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
      </div>

      {/* Image Switcher and Actions */}
      <div className="space-y-3">
        {/* Image Switcher - Only show if multiple images */}
        {allImages.length > 1 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {allImages.map((img, index) => {
              const path = img.path.toLowerCase();
              const isCarded = path.includes('carded-') || path.includes('_carded') || 
                path.includes('/carded') || path.includes('packed');
              const isLoose = path.includes('loose-') || path.includes('_loose') || 
                path.includes('/loose');
              
              // For loose images, try to extract which one (e.g., "loose-XXX-YYY-car1" or "loose-XXX-YYY-transport")
              let label = isCarded ? 'Carded' : isLoose ? 'Loose' : `Resim ${index + 1}`;
              if (isLoose) {
                // Try to extract car/transport info from filename
                const match = img.path.match(/loose-[^-]+-[^-]+-(.+?)\./);
                if (match) {
                  const suffix = match[1];
                  if (suffix === 'transport') {
                    label = 'Transport Loose';
                  } else if (suffix.startsWith('car')) {
                    label = `Car ${suffix.replace('car', '')} Loose`;
                  } else {
                    label = `Loose ${index}`;
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

        {/* Set as Main Image Button */}
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
      </div>
    </div>
  );
}

