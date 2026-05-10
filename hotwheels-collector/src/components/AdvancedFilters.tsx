'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Filter, X, Save, ChevronDown, ChevronUp } from 'lucide-react';

export interface AdvancedFilterData {
  // Fiyat filtreleri
  minPrice?: number;
  maxPrice?: number;
  priceType?: 'packed' | 'loose';

  // Görsel filtreleri
  hasImage?: boolean;

  // Not filtreleri
  hasNotes?: boolean;

  // Ek filtreler
  hasDescription?: boolean;
}

interface AdvancedFiltersProps {
  type: 'variants' | 'models';
  filters: AdvancedFilterData;
  onFiltersChange: (filters: AdvancedFilterData) => void;
  onSaveFilter?: (name: string, filters: AdvancedFilterData) => void;
  savedFilters?: Array<{ id: number; name: string; filterData: string }>;
  onLoadSavedFilter?: (filterData: string) => void;
}

export function AdvancedFilters({
  type,
  filters,
  onFiltersChange,
  onSaveFilter,
  savedFilters = [],
  onLoadSavedFilter,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const updateFilter = (key: keyof AdvancedFilterData, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  const handleSaveFilter = () => {
    if (!saveFilterName.trim() || !onSaveFilter) return;

    onSaveFilter(saveFilterName.trim(), filters);
    setSaveFilterName('');
    setShowSaveDialog(false);
  };

  const handleLoadSavedFilter = (filterData: string) => {
    if (onLoadSavedFilter) {
      try {
        const parsed = JSON.parse(filterData);
        onFiltersChange(parsed);
      } catch (error) {
        console.error('Error loading saved filter:', error);
      }
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle>Gelişmiş Filtreler</CardTitle>
                {hasActiveFilters && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    {Object.keys(filters).length} aktif
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Fiyat Filtreleri */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Fiyat Aralığı</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={filters.priceType || 'packed'}
                    onValueChange={(value) =>
                      updateFilter('priceType', value as 'packed' | 'loose')
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="packed">Kartlı</SelectItem>
                      <SelectItem value="loose">Kutusuz</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice || ''}
                    onChange={(e) =>
                      updateFilter(
                        'minPrice',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice || ''}
                    onChange={(e) =>
                      updateFilter(
                        'maxPrice',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Görsel Filtreleri */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Görsel</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasImage"
                  checked={filters.hasImage === true}
                  onCheckedChange={(checked) =>
                    updateFilter('hasImage', checked === true ? true : undefined)
                  }
                />
                <label
                  htmlFor="hasImage"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Görseli olanlar
                </label>
              </div>
            </div>

            {/* Not Filtreleri */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Not</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasNotes"
                  checked={filters.hasNotes === true}
                  onCheckedChange={(checked) =>
                    updateFilter('hasNotes', checked === true ? true : undefined)
                  }
                />
                <label
                  htmlFor="hasNotes"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Notu olanlar
                </label>
              </div>
            </div>

            {/* Açıklama Filtreleri (sadece models için) */}
            {type === 'models' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Açıklama</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasDescription"
                    checked={filters.hasDescription === true}
                    onCheckedChange={(checked) =>
                      updateFilter(
                        'hasDescription',
                        checked === true ? true : undefined
                      )
                    }
                  />
                  <label
                    htmlFor="hasDescription"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Açıklaması olanlar
                  </label>
                </div>
              </div>
            )}

            {/* Kayıtlı Filtreler */}
            {savedFilters.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-semibold">Kayıtlı Filtreler</Label>
                <div className="flex flex-wrap gap-2">
                  {savedFilters.map((filter) => (
                    <Button
                      key={filter.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadSavedFilter(filter.filterData)}
                    >
                      {filter.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Filtreleri Temizle
                  </Button>
                )}
                {onSaveFilter && hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Filtreyi Kaydet
                  </Button>
                )}
              </div>
            </div>

            {/* Kaydet Dialog */}
            {showSaveDialog && (
              <div className="pt-2 border-t space-y-2">
                <Label>Filtre Adı</Label>
                <div className="flex gap-2">
                  <Input
                    value={saveFilterName}
                    onChange={(e) => setSaveFilterName(e.target.value)}
                    placeholder="Örn: Değerli Modeller"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveFilter();
                      }
                    }}
                  />
                  <Button onClick={handleSaveFilter} size="sm">
                    Kaydet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSaveFilterName('');
                    }}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}




