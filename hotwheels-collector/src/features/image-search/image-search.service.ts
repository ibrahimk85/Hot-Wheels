import { generateOptimizedSearchQuery, ModelData } from '@/lib/gemini';
import { searchGoogleImages, GoogleImageResult } from '@/lib/google-search';
import { downloadAndSaveImage, ModelDataForDownload } from '@/lib/image-download';
import {
  getCachedSearchResults,
  setCachedSearchResults,
  clearCachedSearchResults,
} from './image-search-cache';

/**
 * Optimize search query using Gemini API
 * @param modelData - Model information
 * @returns Optimized search query string
 */
export async function optimizeSearchQuery(
  modelData: ModelData
): Promise<string> {
  return generateOptimizedSearchQuery(modelData);
}

/**
 * Search for images using Google Custom Search API
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of image results
 */
export async function searchImages(
  query: string,
  limit: number = 10
): Promise<GoogleImageResult[]> {
  return searchGoogleImages(query, limit);
}

/**
 * Download image and save to appropriate folder structure
 * @param url - Image URL to download
 * @param modelData - Model information for folder structure
 * @returns Relative path from public folder
 */
export async function downloadImage(
  url: string,
  modelData: ModelDataForDownload
): Promise<string> {
  return downloadAndSaveImage(url, modelData);
}

/**
 * Search images for a model (with caching)
 * @param modelId - Model ID
 * @param modelData - Model information
 * @param limit - Maximum number of results (default: 10)
 * @param forceRefresh - Force refresh by bypassing cache (default: false)
 * @returns Array of image results
 */
export async function searchImagesForModel(
  modelId: number,
  modelData: ModelData,
  limit: number = 10,
  forceRefresh: boolean = false
): Promise<{ query: string; results: GoogleImageResult[] }> {
  // Check cache first (unless forceRefresh is true)
  if (!forceRefresh) {
    const cached = getCachedSearchResults(modelId);
    if (cached) {
      console.log('[IMAGE SEARCH SERVICE] Using cached results for modelId:', modelId);
      return {
        query: cached.query,
        results: cached.results.slice(0, limit),
      };
    }
  } else {
    console.log('[IMAGE SEARCH SERVICE] Force refresh - bypassing cache for modelId:', modelId);
    clearCachedSearchResults(modelId);
  }

  // Generate optimized query
  console.log('[IMAGE SEARCH SERVICE] Generating optimized query for:', modelData);
  const query = await optimizeSearchQuery(modelData);
  console.log('[IMAGE SEARCH SERVICE] Generated query:', query);

  // Search for images
  console.log('[IMAGE SEARCH SERVICE] Searching Google Images with query:', query);
  const results = await searchImages(query, limit);
  console.log('[IMAGE SEARCH SERVICE] Found', results.length, 'results');

  // Cache results
  setCachedSearchResults(modelId, query, results);
  console.log('[IMAGE SEARCH SERVICE] Results cached for modelId:', modelId);

  return { query, results };
}

/**
 * Clear cache for a model (typically called after saving an image)
 * @param modelId - Model ID
 */
export function clearModelSearchCache(modelId: number): void {
  clearCachedSearchResults(modelId);
}

