'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Year {
  id: number;
  year: number;
}

interface Collection {
  id: number;
  name: string;
  code: string | null;
}

interface SubSeries {
  id: number;
  name: string;
}

interface AIModelAddFormProps {
  initialData?: {
    modelName?: string;
    year?: number;
    collection?: string;
    subSeries?: string;
    color?: string;
    wheelType?: string;
    castingId?: string;
    specialDetails?: string;
  };
  onSuccess?: (modelId: number) => void;
  onCancel?: () => void;
}

export function AIModelAddForm({
  initialData,
  onSuccess,
  onCancel,
}: AIModelAddFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [yearId, setYearId] = useState<string>('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [subSeriesId, setSubSeriesId] = useState<string>('');
  const [castingName, setCastingName] = useState(initialData?.modelName || '');
  const [color, setColor] = useState(initialData?.color || '');
  const [wheelType, setWheelType] = useState(initialData?.wheelType || '');
  const [castingId, setCastingId] = useState(initialData?.castingId || '');
  const [specialDetails, setSpecialDetails] = useState(
    initialData?.specialDetails || ''
  );

  // Dropdown data
  const [years, setYears] = useState<Year[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [subSeries, setSubSeries] = useState<SubSeries[]>([]);

  // Loading states
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingSubSeries, setLoadingSubSeries] = useState(false);

  // Load years on mount
  useEffect(() => {
    loadYears();
  }, []);

  // Load collections when year changes
  useEffect(() => {
    if (yearId) {
      loadCollections(parseInt(yearId));
    } else {
      setCollections([]);
      setCollectionId('');
      setSubSeries([]);
      setSubSeriesId('');
    }
  }, [yearId]);

  // Load subseries when collection changes
  useEffect(() => {
    if (collectionId) {
      loadSubSeries(parseInt(collectionId));
    } else {
      setSubSeries([]);
      setSubSeriesId('');
    }
  }, [collectionId]);

  // Auto-select year if initialData has year
  useEffect(() => {
    if (initialData?.year && years.length > 0) {
      const matchingYear = years.find(y => y.year === initialData.year);
      if (matchingYear) {
        setYearId(matchingYear.id.toString());
      }
    }
  }, [initialData?.year, years]);

  const loadYears = async () => {
    setLoadingYears(true);
    try {
      const response = await fetch('/api/ai/years');
      if (response.ok) {
        const data = await response.json();
        setYears(data);
      }
    } catch (err) {
      console.error('Error loading years:', err);
    } finally {
      setLoadingYears(false);
    }
  };

  const loadCollections = async (yearIdNum: number) => {
    setLoadingCollections(true);
    try {
      const response = await fetch(`/api/ai/collections?yearId=${yearIdNum}`);
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
        
        // Auto-select collection if initialData matches
        if (initialData?.collection) {
          const matchingCollection = data.find(
            (c: Collection) => c.name === initialData.collection
          );
          if (matchingCollection) {
            setCollectionId(matchingCollection.id.toString());
          }
        }
      }
    } catch (err) {
      console.error('Error loading collections:', err);
    } finally {
      setLoadingCollections(false);
    }
  };

  const loadSubSeries = async (collectionIdNum: number) => {
    setLoadingSubSeries(true);
    try {
      const response = await fetch(
        `/api/ai/subseries?collectionId=${collectionIdNum}`
      );
      if (response.ok) {
        const data = await response.json();
        setSubSeries(data);
        
        // Auto-select subseries if initialData matches
        if (initialData?.subSeries) {
          const matchingSubSeries = data.find(
            (s: SubSeries) => s.name === initialData.subSeries
          );
          if (matchingSubSeries) {
            setSubSeriesId(matchingSubSeries.id.toString());
          }
        }
      }
    } catch (err) {
      console.error('Error loading subseries:', err);
    } finally {
      setLoadingSubSeries(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!castingName.trim()) {
      setError('Model adı zorunludur');
      return;
    }

    if (!yearId) {
      setError('Yıl seçimi zorunludur');
      return;
    }

    if (!collectionId) {
      setError('Koleksiyon seçimi zorunludur');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ai/add-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castingName: castingName.trim(),
          yearId: parseInt(yearId),
          collectionId: parseInt(collectionId),
          subSeriesId: subSeriesId ? parseInt(subSeriesId) : undefined,
          color: color.trim() || undefined,
          wheelType: wheelType.trim() || undefined,
          castingId: castingId.trim() || undefined,
          specialDetails: specialDetails.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Model eklenemedi');
      }

      const data = await response.json();
      
      if (onSuccess) {
        onSuccess(data.model.id);
      } else {
        // Default: redirect to model page
        router.push(`/model/${data.model.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Yeni Model Ekle
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Year Selection */}
          <div className="space-y-2">
            <Label htmlFor="year">Yıl *</Label>
            <Select value={yearId} onValueChange={setYearId} disabled={loadingYears}>
              <SelectTrigger id="year">
                <SelectValue placeholder={loadingYears ? 'Yükleniyor...' : 'Yıl seç'} />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id.toString()}>
                    {year.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Collection Selection */}
          <div className="space-y-2">
            <Label htmlFor="collection">Koleksiyon *</Label>
            <Select
              value={collectionId}
              onValueChange={setCollectionId}
              disabled={!yearId || loadingCollections}
            >
              <SelectTrigger id="collection">
                <SelectValue
                  placeholder={
                    !yearId
                      ? 'Önce yıl seçin'
                      : loadingCollections
                      ? 'Yükleniyor...'
                      : 'Koleksiyon seç'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id.toString()}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SubSeries Selection */}
          <div className="space-y-2">
            <Label htmlFor="subseries">Alt Seri (Opsiyonel)</Label>
            <Select
              value={subSeriesId}
              onValueChange={setSubSeriesId}
              disabled={!collectionId || loadingSubSeries}
            >
              <SelectTrigger id="subseries">
                <SelectValue
                  placeholder={
                    !collectionId
                      ? 'Önce koleksiyon seçin'
                      : loadingSubSeries
                      ? 'Yükleniyor...'
                      : 'Alt seri seç (opsiyonel)'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subSeries.length === 0 && collectionId ? (
                  <SelectItem value="none" disabled>
                    Bu koleksiyon için alt seri yok
                  </SelectItem>
                ) : (
                  subSeries.map((ss) => (
                    <SelectItem key={ss.id} value={ss.id.toString()}>
                      {ss.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="castingName">Model Adı (Casting Name) *</Label>
            <Input
              id="castingName"
              value={castingName}
              onChange={(e) => setCastingName(e.target.value)}
              placeholder="Örn: 1967 Ford Mustang"
              required
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Renk</Label>
            <Input
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Örn: Beyaz, Siyah"
            />
          </div>

          {/* Wheel Type */}
          <div className="space-y-2">
            <Label htmlFor="wheelType">Jant Tipi</Label>
            <Input
              id="wheelType"
              value={wheelType}
              onChange={(e) => setWheelType(e.target.value)}
              placeholder="Örn: Real Riders, 5-Spoke"
            />
          </div>

          {/* Casting ID */}
          <div className="space-y-2">
            <Label htmlFor="castingId">Casting ID</Label>
            <Input
              id="castingId"
              value={castingId}
              onChange={(e) => setCastingId(e.target.value)}
              placeholder="Opsiyonel"
            />
          </div>

          {/* Special Details */}
          <div className="space-y-2">
            <Label htmlFor="specialDetails">Özel Detaylar</Label>
            <Input
              id="specialDetails"
              value={specialDetails}
              onChange={(e) => setSpecialDetails(e.target.value)}
              placeholder="Örn: 428 C.I., 67, özel grafikler"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Koleksiyona Ekle
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                İptal
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

