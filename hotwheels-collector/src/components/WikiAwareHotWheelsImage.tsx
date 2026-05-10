'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { dimensionsLookLikeFandomWikiPlaceholder } from '@/lib/wiki-image-placeholder';

function normalizePublicPath(p: string): string {
  let normalizedPath = p.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  return normalizedPath.replace(/\/+/g, '/');
}

type Candidate = { id: number; path: string; alt: string | null };

type WikiAwareHotWheelsImageProps = {
  candidates: Candidate[];
  altFallback: string;
  /** Container for fill Image (default matches VariantCard / ModelCard). */
  className?: string;
  sizes?: string;
};

/**
 * Tries each candidate in order; after decode, skips Fandom "Image Not Available" sized JPEGs
 * (saved locally as normal *_carded.jpg — path/alt heuristics miss these).
 */
export function WikiAwareHotWheelsImage({
  candidates,
  altFallback,
  className = 'relative w-full h-40 rounded-md overflow-hidden bg-transparent',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
}: WikiAwareHotWheelsImageProps) {
  const key = useMemo(() => candidates.map((c) => c.id).join(','), [candidates]);

  const [index, setIndex] = useState(0);
  const [exhaustedPlaceholders, setExhaustedPlaceholders] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhaustedPlaceholders(false);
  }, [key]);

  const current = candidates[index];

  const onLoadingComplete = useCallback(
    (el: HTMLImageElement) => {
      const w = el.naturalWidth;
      const h = el.naturalHeight;
      if (!dimensionsLookLikeFandomWikiPlaceholder(w, h)) {
        return;
      }
      setIndex((i) => {
        if (i < candidates.length - 1) {
          return i + 1;
        }
        queueMicrotask(() => setExhaustedPlaceholders(true));
        return i;
      });
    },
    [candidates.length],
  );

  if (candidates.length === 0 || exhaustedPlaceholders) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground ${className}`}
      >
        Görsel yok
      </div>
    );
  }

  if (!current?.path) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground ${className}`}
      >
        Görsel yok
      </div>
    );
  }

  return (
    <div className={className}>
      <Image
        key={`${current.id}-${index}`}
        src={normalizePublicPath(current.path)}
        alt={current.alt ?? altFallback}
        fill
        sizes={sizes}
        className="object-contain"
        unoptimized
        onLoadingComplete={onLoadingComplete}
      />
    </div>
  );
}
