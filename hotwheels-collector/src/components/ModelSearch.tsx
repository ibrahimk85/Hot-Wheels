'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface SubSeriesWithImage {
  id: number;
  name: string;
  collection: {
    year: { year: number };
    name: string;
  };
  models: Array<{
    id: number;
    castingName: string;
    castingId: string | null;
  }>;
  _count: { models: number };
  randomModelImage: {
    path: string;
    alt: string | null;
  } | null;
}

interface ModelSearchProps {
  subSeries: SubSeriesWithImage[];
  onFilteredChange: (filtered: SubSeriesWithImage[]) => void;
  hasElite64Future?: boolean;
}

export function ModelSearch({ subSeries, onFilteredChange, hasElite64Future = false }: ModelSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Get available years from sub-series
  const availableYears = useMemo(() => {
    const years = new Set<number | 'Future'>();
    subSeries.forEach((item) => {
      const year = item.collection.year.year;
      // Check if this is an Elite 64 Future collection (year 9999 is used for Future)
      if (item.collection.name === 'Elite 64' && year === 9999) {
        // This is a Future collection
        if (hasElite64Future) {
          years.add('Future');
        }
      } else if (year !== 9999) {
        // Only add regular years (not 9999)
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => {
      if (a === 'Future') return 1;
      if (b === 'Future') return -1;
      return b - a; // Descending order
    });
  }, [subSeries, hasElite64Future]);

  const filteredSubSeries = useMemo(() => {
    let filtered = subSeries;

    // Filter by year
    if (selectedYear && selectedYear !== 'all') {
      if (selectedYear === 'Future') {
        // Filter for Elite 64 Future collections (year 9999)
        filtered = filtered.filter((item) => {
          return item.collection.name === 'Elite 64' && item.collection.year.year === 9999;
        });
      } else {
        const yearNum = Number(selectedYear);
        filtered = filtered.filter((item) => {
          return item.collection.year.year === yearNum;
        });
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      filtered = filtered.filter((item) => {
        const name = item.name.toLowerCase();
        const collectionName = item.collection.name.toLowerCase();
        const year = item.collection.year.year.toString();
        
        // Search in model names (castingName)
        const modelNamesMatch = item.models.some((model) => {
          const castingName = model.castingName.toLowerCase();
          const castingId = model.castingId?.toLowerCase() || '';
          return castingName.includes(query) || castingId.includes(query);
        });

        // Search in toy numbers (castingId)
        const toyNumberMatch = item.models.some((model) => {
          return model.castingId?.toLowerCase().includes(query) || false;
        });

        return (
          name.includes(query) ||
          collectionName.includes(query) ||
          year.includes(query) ||
          modelNamesMatch ||
          toyNumberMatch
        );
      });
    }

    return filtered;
  }, [searchQuery, selectedYear, subSeries]);

  useEffect(() => {
    onFilteredChange(filteredSubSeries);
  }, [filteredSubSeries, onFilteredChange]);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        {/* Year Filter */}
        {(hasElite64Future || availableYears.length > 0) && (
          <div className="w-full sm:w-auto min-w-[150px]">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Yıl filtresi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Yıllar</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year.toString()} value={year.toString()}>
                    {year === 'Future' ? 'Future' : year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Model, Alt Seri, Seri, Yıl veya Toy# ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
}







