'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollRestore } from './ScrollRestore';
import { InfoStats } from './InfoStats';
import { ModelsCompletionList } from './ModelsCompletionList';
import type { SubSeriesCompletionSummaryItem } from '@/features/models/model.service';

interface ModelsPageClientProps {
  completionItems: SubSeriesCompletionSummaryItem[];
}

export function ModelsPageClient({ completionItems }: ModelsPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const availableYears = useMemo(
    () => Array.from(new Set(completionItems.map((item) => item.year))).sort((a, b) => b - a),
    [completionItems]
  );
  const availableCollections = useMemo(
    () => Array.from(new Set(completionItems.map((item) => item.collectionName))).sort((a, b) => a.localeCompare(b)),
    [completionItems]
  );

  const compareSubSeriesOldToNew = (aName: string, bName: string) => {
    const extractOrder = (name: string) => {
      const match = name.match(/(?:mix|seri|series)\s*(\d+)/i) ?? name.match(/(\d+)/);
      return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    };

    const aOrder = extractOrder(aName);
    const bOrder = extractOrder(bName);

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return aName.localeCompare(bName, 'tr', { numeric: true, sensitivity: 'base' });
  };

  const compareByYearDescAndSubSeriesAsc = (
    a: SubSeriesCompletionSummaryItem,
    b: SubSeriesCompletionSummaryItem
  ) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    const subSeriesOrder = compareSubSeriesOldToNew(a.subSeriesName, b.subSeriesName);
    if (subSeriesOrder !== 0) {
      return subSeriesOrder;
    }
    return a.collectionName.localeCompare(b.collectionName, 'tr', { sensitivity: 'base' });
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return completionItems.filter((item) => {
      const matchesQuery =
        !query ||
        item.subSeriesName.toLowerCase().includes(query) ||
        item.collectionName.toLowerCase().includes(query) ||
        item.year.toString().includes(query);
      const matchesYear = selectedYear === 'all' || item.year === Number(selectedYear);
      const matchesCollection = selectedCollection === 'all' || item.collectionName === selectedCollection;
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'completed' && item.isCompleted) ||
        (selectedStatus === 'incomplete' && !item.isCompleted);

      return matchesQuery && matchesYear && matchesCollection && matchesStatus;
    });
  }, [searchQuery, completionItems, selectedYear, selectedCollection, selectedStatus]);

  const completedItems = useMemo(
    () =>
      filteredItems
        .filter((item) => item.isCompleted)
        .sort(compareByYearDescAndSubSeriesAsc),
    [filteredItems]
  );

  const incompleteItems = useMemo(
    () =>
      filteredItems
        .filter((item) => !item.isCompleted)
        .sort(compareByYearDescAndSubSeriesAsc),
    [filteredItems]
  );

  const stats = useMemo(() => {
    const totalSubSeries = completionItems.length;
    const completedCount = completionItems.filter((item) => item.isCompleted).length;
    const completionPercentage = totalSubSeries > 0 ? (completedCount / totalSubSeries) * 100 : 0;

    return [
      { label: 'Alt Seri', value: totalSubSeries },
      { label: 'Tamamlanan', value: completedCount },
      { label: 'Tamamlanma', value: `%${completionPercentage.toFixed(1)}` },
    ];
  }, [completionItems]);

  return (
    <div className="space-y-6">
      <ScrollRestore />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-semibold">Modeller</h2>
        <InfoStats items={stats} />
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
          placeholder="Koleksiyon, alt seri veya yıl ile ara..."
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger>
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum yillar</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
          <SelectTrigger>
            <SelectValue placeholder="Koleksiyon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum koleksiyonlar</SelectItem>
            {availableCollections.map((collection) => (
              <SelectItem key={collection} value={collection}>
                {collection}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum durumlar</SelectItem>
            <SelectItem value="incomplete">Tamamlanmayan</SelectItem>
            <SelectItem value="completed">Tamamlanan</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-8">
        <ModelsCompletionList title="Tamamlanmayanlar" items={incompleteItems} emptyText="Tamamlanmayan alt seri bulunamadı." />
        <ModelsCompletionList title="Tamamlananlar" items={completedItems} emptyText="Tamamlanan alt seri bulunamadı." />
      </div>
    </div>
  );
}





