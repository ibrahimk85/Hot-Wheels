import { GoogleImageResult } from '@/lib/google-search';

export interface CachedSearchResult {
  query: string;
  results: GoogleImageResult[];
  timestamp: number;
}

// In-memory cache for search results
const cache = new Map<number, CachedSearchResult>();

// TTL: 1 hour in milliseconds
const TTL = 60 * 60 * 1000;

/**
 * Get cached search results for a model
 * @param modelId - Model ID
 * @returns Cached results or null if not found or expired
 */
export function getCachedSearchResults(
  modelId: number
): CachedSearchResult | null {
  const cached = cache.get(modelId);

  if (!cached) {
    return null;
  }

  // Check if cache is expired
  const now = Date.now();
  if (now - cached.timestamp > TTL) {
    cache.delete(modelId);
    return null;
  }

  return cached;
}

/**
 * Cache search results for a model
 * @param modelId - Model ID
 * @param query - Search query used
 * @param results - Search results
 */
export function setCachedSearchResults(
  modelId: number,
  query: string,
  results: GoogleImageResult[]
): void {
  cache.set(modelId, {
    query,
    results,
    timestamp: Date.now(),
  });
}

/**
 * Clear cached search results for a model
 * @param modelId - Model ID
 */
export function clearCachedSearchResults(modelId: number): void {
  cache.delete(modelId);
}

/**
 * Clear all cached search results
 */
export function clearAllCachedSearchResults(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ modelId: number; age: number }>;
} {
  const entries = Array.from(cache.entries()).map(([modelId, cached]) => ({
    modelId,
    age: Date.now() - cached.timestamp,
  }));

  return {
    size: cache.size,
    entries,
  };
}








