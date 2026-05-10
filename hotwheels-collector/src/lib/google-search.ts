import axios from 'axios';
import { getSetting } from '@/features/settings/settings.service';

export interface GoogleImageResult {
  link: string;
  title: string;
  displayLink: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize?: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface GoogleSearchResponse {
  items?: GoogleImageResult[];
}

/**
 * Search Google Images using Custom Search API
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 10, max: 10 per request)
 * @returns Array of image results
 */
export async function searchGoogleImages(
  query: string,
  limit: number = 10
): Promise<GoogleImageResult[]> {
  console.log('[GOOGLE SEARCH] Starting search with query:', query);
  const apiKey = await getSetting('google_search_api_key');
  const searchEngineId = await getSetting('google_search_engine_id');

  if (!apiKey) {
    console.error('[GOOGLE SEARCH] API key not configured');
    throw new Error(
      'Google Search API key not configured. Please set it in Settings.'
    );
  }

  if (!searchEngineId) {
    console.error('[GOOGLE SEARCH] Search Engine ID not configured');
    throw new Error(
      'Google Search Engine ID not configured. Please set it in Settings.'
    );
  }

  // Google Custom Search API allows max 10 results per request
  const numResults = Math.min(limit, 10);
  console.log('[GOOGLE SEARCH] Requesting', numResults, 'results');

  try {
    const response = await axios.get<GoogleSearchResponse>(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: apiKey,
          cx: searchEngineId,
          q: query,
          searchType: 'image',
          num: numResults,
          safe: 'active',
          imgSize: 'large', // Prefer larger images
          imgType: 'photo', // Prefer photos over illustrations
        },
      }
    );

    const items = response.data.items || [];
    console.log('[GOOGLE SEARCH] Found', items.length, 'results');
    if (items.length === 0) {
      console.warn('[GOOGLE SEARCH] No results found for query:', query);
    }
    return items;
  } catch (error) {
    console.error('[GOOGLE SEARCH] Error:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error(
          'Google Search API rate limit exceeded. Please try again later.'
        );
      }
      if (error.response?.status === 403) {
        throw new Error(
          'Google Search API access denied. Please check your API key and Search Engine ID.'
        );
      }
      throw new Error(
        `Google Search API error: ${error.response?.statusText || error.message}`
      );
    }
    throw new Error(
      `Failed to search Google Images: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

