'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageSearchDialog } from '@/components/ImageSearchDialog';
import { Search } from 'lucide-react';
import {
  isMainlineOrdinalColorVariant,
  mainlineOrdinalColorBadgeText,
} from '@/lib/mainline-color-variant';

interface ModelSearchCardProps {
  model: {
    id: number;
    castingName: string;
    toyNumber: string | null;
    images: Array<{
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
        year: {
          year: number;
        };
      } | null;
    } | null;
    variants: Array<{
      id: number;
      cardNumber: string | null;
      color: string | null;
      toyNumber: string | null;
    }>;
  };
}

export function ModelSearchCard({ model }: ModelSearchCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const subSeries = model.subSeries;
  const collection = subSeries?.collection;
  const year = collection?.year?.year;

  // Get first image if available
  const mainImage = model.images && model.images.length > 0 ? model.images[0] : null;

  const colorVariantText =
    collection?.name === 'Mainline'
      ? (model.variants ?? [])
          .map(v => mainlineOrdinalColorBadgeText(v.color))
          .find(Boolean) ?? null
      : null;

  const getVariantForSearch = () => {
    if (collection?.name !== 'Mainline') return null;
    return (model.variants ?? []).find(v => isMainlineOrdinalColorVariant(v.color)) ?? null;
  };

  const variantForSearch = getVariantForSearch();
  // Use variant's Toy# if it's a 2nd/3rd color, otherwise use first variant's Toy# or model's Toy#
  const firstVariant = model.variants && model.variants.length > 0 ? model.variants[0] : null;
  const toyNumberForSearch = variantForSearch?.toyNumber || firstVariant?.toyNumber || model.toyNumber || undefined;
  const cardNumberForSearch = variantForSearch?.cardNumber || firstVariant?.cardNumber || undefined;
  
  // Get Toy# to display on card - use the same logic as search to ensure consistency
  const toyNumberToDisplay = toyNumberForSearch;

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-muted">
            {mainImage ? (
              <Image
                src={mainImage.path}
                alt={mainImage.alt || model.castingName}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-4">
                  <p className="text-sm">Görsel Yok</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 space-y-2">
            <h3 className="font-semibold text-sm line-clamp-2">{model.castingName}</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              {year && <p>Yıl: {year}</p>}
              {collection && <p>Koleksiyon: {collection.name}</p>}
              {/* Show Toy# from first variant if available, otherwise from model */}
              {toyNumberToDisplay && <p>Toy#: {toyNumberToDisplay}</p>}
              {colorVariantText && (
                <p className="font-medium text-primary">{colorVariantText}</p>
              )}
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => setIsDialogOpen(true)}
              variant={mainImage ? 'outline' : 'default'}
            >
              <Search className="mr-2 h-4 w-4" />
              {mainImage ? 'Resim Değiştir' : 'Resim Ara'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ImageSearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        modelId={model.id}
        modelData={{
          castingName: model.castingName,
          year: year,
          collectionName: collection?.name,
          toyNumber: toyNumberForSearch,
          cardNumber: cardNumberForSearch,
        }}
      />
    </>
  );
}

