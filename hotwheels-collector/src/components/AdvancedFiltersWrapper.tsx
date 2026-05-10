'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdvancedFilters, AdvancedFilterData } from './AdvancedFilters';

interface AdvancedFiltersWrapperProps {
  type: 'variants' | 'models';
  savedFilters?: Array<{ id: number; name: string; filterData: string }>;
}

export function AdvancedFiltersWrapper({
  type,
  savedFilters = [],
}: AdvancedFiltersWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdvancedFilterData>({});

  // URL'den filtreleri yükle
  useEffect(() => {
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const priceType = searchParams.get('priceType');
    const hasImage = searchParams.get('hasImage');
    const hasNotes = searchParams.get('hasNotes');
    const hasDescription = searchParams.get('hasDescription');

    setFilters({
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      priceType: priceType as 'packed' | 'loose' | undefined,
      hasImage: hasImage === 'true' ? true : undefined,
      hasNotes: hasNotes === 'true' ? true : undefined,
      hasDescription: hasDescription === 'true' ? true : undefined,
    });
  }, [searchParams]);

  const handleFiltersChange = (newFilters: AdvancedFilterData) => {
    setFilters(newFilters);

    // URL'i güncelle
    const params = new URLSearchParams(searchParams.toString());

    // Mevcut gelişmiş filtreleri temizle
    params.delete('minPrice');
    params.delete('maxPrice');
    params.delete('priceType');
    params.delete('hasImage');
    params.delete('hasNotes');
    params.delete('hasDescription');

    // Yeni filtreleri ekle
    if (newFilters.minPrice !== undefined) {
      params.set('minPrice', newFilters.minPrice.toString());
    }
    if (newFilters.maxPrice !== undefined) {
      params.set('maxPrice', newFilters.maxPrice.toString());
    }
    if (newFilters.priceType) {
      params.set('priceType', newFilters.priceType);
    }
    if (newFilters.hasImage === true) {
      params.set('hasImage', 'true');
    }
    if (newFilters.hasNotes === true) {
      params.set('hasNotes', 'true');
    }
    if (newFilters.hasDescription === true) {
      params.set('hasDescription', 'true');
    }

    // Sayfa numarasını sıfırla
    params.delete('page');

    router.push(`/${type}?${params.toString()}`);
  };

  const handleSaveFilter = async (name: string, filterData: AdvancedFilterData) => {
    try {
      const response = await fetch('/api/filters/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          filterData,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save filter');
      }

      // Sayfayı yenile (saved filters'ı güncellemek için)
      router.refresh();
    } catch (error) {
      console.error('Error saving filter:', error);
      alert('Filtre kaydedilirken bir hata oluştu.');
    }
  };

  const handleLoadSavedFilter = (filterDataString: string) => {
    try {
      const parsed = JSON.parse(filterDataString);
      handleFiltersChange(parsed);
    } catch (error) {
      console.error('Error loading saved filter:', error);
    }
  };

  return (
    <AdvancedFilters
      type={type}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      onSaveFilter={handleSaveFilter}
      savedFilters={savedFilters}
      onLoadSavedFilter={handleLoadSavedFilter}
    />
  );
}




