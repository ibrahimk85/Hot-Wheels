'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  selectedYear?: number;
  search?: string;
  onlyTH?: boolean;
  onlySTH?: boolean;
  /** Generic owned filter (e.g. /model-search uses `owned=`) */
  ownedStatus?: boolean;
  packedOwnedStatus?: boolean;
  looseOwnedStatus?: boolean;
  wishlistedStatus?: boolean;
  collectionName?: string;
  collectionId?: number;
  subSeriesId?: number;
  category?: string; // Silver Series: Anniversary
  subSeriesName?: string; // Silver Series: Purple and Gold (2025), etc.
  basePath?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  selectedYear,
  search,
  onlyTH,
  onlySTH,
  ownedStatus,
  packedOwnedStatus,
  looseOwnedStatus,
  wishlistedStatus,
  collectionName,
  collectionId,
  subSeriesId,
  category,
  subSeriesName,
  basePath = '/variants',
}: PaginationProps) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (selectedYear) params.set('year', selectedYear.toString());
    if (search) params.set('q', search);
    if (onlyTH) params.set('th', '1');
    if (onlySTH) params.set('sth', '1');
    if (ownedStatus !== undefined) params.set('owned', ownedStatus ? '1' : '0');
    if (packedOwnedStatus !== undefined) params.set('packedOwned', packedOwnedStatus ? '1' : '0');
    if (looseOwnedStatus !== undefined) params.set('looseOwned', looseOwnedStatus ? '1' : '0');
    if (wishlistedStatus !== undefined) params.set('wish', wishlistedStatus ? '1' : '0');
    if (collectionName) {
      params.set('collection', collectionName);
    } else if (collectionId) {
      params.set('collection', collectionId.toString());
    }
    if (collectionName === 'Hot Wheels Silver Series') {
      if (category) params.set('category', category);
      if (subSeriesName) params.set('subSeries', subSeriesName);
    } else if (subSeriesId) {
      params.set('subSeries', subSeriesId.toString());
    }
    return `${basePath}?${params.toString()}`;
  };

  // Calculate which page numbers to show
  // Modern pagination pattern: show first, last, current, and nearby pages
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Near the beginning: 1, 2, 3, 4, 5, ..., last
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis-end');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near the end: 1, ..., n-4, n-3, n-2, n-1, n
        // Show pages like: 1, ..., 9, 10, 11, 12, 13
        pages.push('ellipsis-start');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle: 1, ..., current-1, current, current+1, ..., last
        pages.push('ellipsis-start');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis-end');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      {/* Info */}
      <div className="text-sm text-muted-foreground">
        {selectedYear ? `${selectedYear} yılı • ` : ''}Toplam {totalCount} kayıt • Sayfa {currentPage} / {totalPages}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* First Page - only show if not on first page */}
        {currentPage > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(1)}>İlk Sayfa</Link>
          </Button>
        )}

        {/* Previous */}
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
        >
          <Link href={buildUrl(Math.max(1, currentPage - 1))}>← Önceki</Link>
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis-start' || page === 'ellipsis-end') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              );
            }
            
            const pageNum = page as number;
            const isActive = pageNum === currentPage;
            
            return (
              <Button
                key={pageNum}
                asChild
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="min-w-[40px]"
              >
                <Link href={buildUrl(pageNum)}>{pageNum}</Link>
              </Button>
            );
          })}
        </div>

        {/* Next */}
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
        >
          <Link href={buildUrl(Math.min(totalPages, currentPage + 1))}>Sonraki →</Link>
        </Button>

        {/* Last Page - only show if not on last page */}
        {currentPage < totalPages && (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(totalPages)}>En Son Sayfa</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

