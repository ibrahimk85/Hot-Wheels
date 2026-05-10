import prisma from '@/db';

export interface FuzzyMatchResult {
  id: number;
  castingName: string;
  castingId: string | null;
  similarity: number;
  collectionName?: string;
  year?: number;
}

/**
 * Levenshtein distance hesaplama
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Similarity score hesaplama (0-1 arası)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return shorter.length / longer.length;
  }
  
  // Levenshtein distance based similarity
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const similarity = 1 - (distance / maxLen);
  
  // Word-based matching
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return Math.max(0, similarity);
  }
  
  const commonWords = words1.filter(w => words2.includes(w));
  const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  // Combine Levenshtein and word-based similarity
  return Math.max(similarity, wordSimilarity * 0.8);
}

/**
 * Normalize model name for better matching
 * - Remove common prefixes/suffixes
 * - Normalize numbers (1967 -> 67, etc.)
 */
function normalizeModelName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Remove common prefixes
  normalized = normalized.replace(/^(hot\s*wheels|hw)\s*/i, '');
  
  // Normalize year formats (1967 -> 67, '67 -> 67)
  normalized = normalized.replace(/\b19(\d{2})\b/g, '$1');
  normalized = normalized.replace(/\b20(\d{2})\b/g, '$1');
  normalized = normalized.replace(/'(\d{2})\b/g, '$1');
  
  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Fuzzy match model names in database
 */
export async function fuzzyMatchModel(
  searchName: string,
  options: {
    threshold?: number; // Minimum similarity threshold (0-1)
    limit?: number;     // Maximum results
    includeDetails?: boolean; // Include collection and year info
  } = {}
): Promise<FuzzyMatchResult[]> {
  const {
    threshold = 0.3,
    limit = 10,
    includeDetails = false,
  } = options;

  const normalizedSearch = normalizeModelName(searchName);
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 2);

  if (searchWords.length === 0) {
    return [];
  }

  // Get all models (or a subset if we want to optimize)
  const models = await prisma.model.findMany({
    take: includeDetails ? 1000 : 500, // Limit for performance
    select: {
      id: true,
      castingName: true,
      castingId: true,
      ...(includeDetails && {
        collection: {
          select: {
            name: true,
            year: {
              select: {
                year: true,
              },
            },
          },
        },
      }),
    },
    orderBy: {
      id: 'desc', // Recent models first
    },
  });

  // Calculate similarity for each model
  const matches: FuzzyMatchResult[] = models
    .map(model => {
      const normalizedModel = normalizeModelName(model.castingName);
      const similarity = calculateSimilarity(normalizedSearch, normalizedModel);
      
      return {
        id: model.id,
        castingName: model.castingName,
        castingId: model.castingId,
        similarity,
        ...(includeDetails && {
          collectionName: model.collection?.name,
          year: model.collection?.year?.year,
        }),
      };
    })
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return matches;
}

/**
 * Find best matching model in database
 */
export async function findBestMatch(
  searchName: string,
  options: {
    threshold?: number;
    includeDetails?: boolean;
  } = {}
): Promise<FuzzyMatchResult | null> {
  const matches = await fuzzyMatchModel(searchName, {
    ...options,
    limit: 1,
  });

  return matches.length > 0 ? matches[0] : null;
}

