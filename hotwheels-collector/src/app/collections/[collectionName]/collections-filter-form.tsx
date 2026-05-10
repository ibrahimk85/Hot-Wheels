'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CollectionsFilterFormProps {
  years: Array<{ id: number; year: number }>;
  categoriesForCollection?: Array<{ id: string; name: string }>; // For Silver Series: 1st level (Anniversary, etc.)
  subSeriesForCollection: Array<{ id: number; name: string }>;
  selectedYear?: number;
  selectedCategory?: string; // For Silver Series
  subSeriesId?: number;
  subSeriesName?: string; // For Boulevard / Silver Series
  search?: string;
  ownedStatus?: boolean;
  wishlistedStatus?: boolean;
  collectionName: string;
}

export default function CollectionsFilterForm({
  years,
  categoriesForCollection = [],
  subSeriesForCollection,
  selectedYear,
  selectedCategory,
  subSeriesId,
  subSeriesName,
  search,
  ownedStatus,
  wishlistedStatus,
  collectionName,
}: CollectionsFilterFormProps) {
  const router = useRouter();
  const isBoulevard = collectionName === 'Boulevard';
  const isSilverSeries = collectionName === 'Hot Wheels Silver Series';
  const [year, setYear] = useState(
    selectedYear ? selectedYear.toString() : 'all'
  );
  const [category, setCategory] = useState(
    isSilverSeries ? (selectedCategory ?? 'all') : 'all'
  );
  const [subSeries, setSubSeries] = useState(
    isBoulevard || isSilverSeries
      ? (subSeriesName ?? 'all')
      : (subSeriesId?.toString() ?? 'all')
  );
  const [owned, setOwned] = useState(
    ownedStatus === true ? '1' : ownedStatus === false ? '0' : 'all'
  );
  const [wish, setWish] = useState(
    wishlistedStatus === true ? '1' : wishlistedStatus === false ? '0' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState(search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? '');
  const [availableYears, setAvailableYears] = useState(years);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // For Silver Series: Fetch years dynamically when SubSeries changes
  useEffect(() => {
    if (isSilverSeries && subSeries && subSeries !== 'all') {
      const fetchYears = async () => {
        try {
          const params = new URLSearchParams({
            collectionName: 'Hot Wheels Silver Series',
            subSeriesName: subSeries,
          });
          const response = await fetch(`/api/subseries/years?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setAvailableYears(data.years.map((y: number) => ({ id: y, year: y })));
          }
        } catch (error) {
          console.error('Error fetching years:', error);
        }
      };
      fetchYears();
    } else if (isSilverSeries && subSeries === 'all') {
      // Reset to all years when "Hepsi" is selected
      const fetchAllYears = async () => {
        try {
          const params = new URLSearchParams({
            collectionName: 'Hot Wheels Silver Series',
          });
          const response = await fetch(`/api/subseries/years?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setAvailableYears(data.years.map((y: number) => ({ id: y, year: y })));
          }
        } catch (error) {
          console.error('Error fetching all years:', error);
        }
      };
      fetchAllYears();
    } else {
      // For other collections, use provided years
      setAvailableYears(years);
    }
  }, [subSeries, isSilverSeries, years]);

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    if (!isSilverSeries) setSubSeries('all');
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setSubSeries('all');
  };

  useEffect(() => {
    if (isSilverSeries && selectedCategory !== undefined && selectedCategory !== category) {
      setCategory(selectedCategory);
    }
  }, [selectedCategory, isSilverSeries]);

  useEffect(() => {
    if (isSilverSeries && subSeriesName !== undefined && subSeriesName !== subSeries) {
      setSubSeries(subSeriesName);
    }
  }, [subSeriesName, isSilverSeries]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (year && year !== 'all') params.set('year', year);
    if (isSilverSeries && category && category !== 'all') params.set('category', category);
    if (subSeries && subSeries !== 'all') {
      params.set('subSeries', subSeries);
    }
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (owned && owned !== 'all') params.set('owned', owned);
    if (wish && wish !== 'all') params.set('wish', wish);

    const urlSlug = collectionName.toLowerCase().replace(/\s+/g, '-').replace(/\s*&\s*/g, '-and-').replace(/-+/g, '-');
    router.push(`/collections/${urlSlug}?${params.toString()}`);
  }, [year, category, subSeries, debouncedSearch, owned, wish, collectionName, isSilverSeries, router]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Yıl</Label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger id="year" className="w-[140px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y.id} value={y.year.toString()}>
                    {y.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSilverSeries && categoriesForCollection.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Alt Seri</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category" className="w-[160px]">
                  <SelectValue placeholder="Hepsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {categoriesForCollection.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* For Silver Series: 2nd Alt Seri (Blue and Gold, Purple and Gold) only when 1st (Anniversary) is selected */}
          {subSeriesForCollection.length > 0 && !(isSilverSeries && category === 'all') && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="subSeries">{isSilverSeries ? 'Seri' : 'Alt Seri'}</Label>
              <Select value={subSeries} onValueChange={setSubSeries}>
                <SelectTrigger id="subSeries" className="w-[200px]">
                  <SelectValue placeholder="Hepsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {subSeriesForCollection.map((ss, idx) => (
                    <SelectItem
                      key={ss.id || idx}
                      value={isBoulevard || isSilverSeries ? ss.name : ss.id.toString()}
                    >
                      {ss.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="q">Arama (Model Adı)</Label>
            <Input
              id="q"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mazda, Tesla, Skyline…"
              className="w-[200px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owned">Bende Var</Label>
            <Select value={owned} onValueChange={setOwned}>
              <SelectTrigger id="owned" className="w-[160px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Sahip Olduklarım</SelectItem>
                <SelectItem value="0">Eksik Olanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="wish">Wishlist</Label>
            <Select value={wish} onValueChange={setWish}>
              <SelectTrigger id="wish" className="w-[180px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Wishlist'tekiler</SelectItem>
                <SelectItem value="0">Wishlist'te olmayanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

