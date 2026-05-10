import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import { getModelById } from '@/features/models/model.service';
import { searchImagesForModel, clearModelSearchCache } from '@/features/image-search/image-search.service';
import { ModelData } from '@/lib/gemini';
import { isMainlineOrdinalColorVariant } from '@/lib/mainline-color-variant';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, forceRefresh } = body;

    console.log('[IMAGE SEARCH API] Request received:', { modelId, forceRefresh });

    if (!modelId || typeof modelId !== 'number') {
      console.error('[IMAGE SEARCH API] Invalid modelId:', modelId);
      return NextResponse.json(
        { error: 'Invalid modelId. Must be a number.' },
        { status: 400 }
      );
    }

    // Fetch model data with all necessary information
    const model = await getModelById(modelId);
    console.log('[IMAGE SEARCH API] Model fetched:', { 
      id: model?.id, 
      castingName: model?.castingName,
      toyNumber: model?.toyNumber,
      collectionName: model?.subSeries?.collection?.name 
    });

    if (!model) {
      console.error('[IMAGE SEARCH API] Model not found for ID:', modelId);
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    const collectionName = model.subSeries?.collection?.name;
    let variantForSearch: typeof model.variants[0] | null = null;

    if (collectionName === 'Mainline' && model.variants.length > 0) {
      variantForSearch =
        model.variants.find(v => isMainlineOrdinalColorVariant(v.color)) ?? null;
    }

    const toyNumberForSearch = variantForSearch?.toyNumber || model.toyNumber || undefined;

    // Prepare model data for search
    const modelData: ModelData = {
      castingName: model.castingName,
      year: model.subSeries?.collection?.year?.year,
      collectionName: collectionName,
      toyNumber: toyNumberForSearch,
      variants: model.variants.map((variant) => ({
        cardNumber: variant.cardNumber || undefined,
        toyNumber: variant.toyNumber || undefined,
        color: variant.color || undefined,
        year: variant.year,
      })),
    };

    // Search for images (with caching)
    // Pass forceRefresh to searchImagesForModel so it can bypass cache if needed
    console.log('[IMAGE SEARCH API] Searching images for model:', modelData, 'forceRefresh:', forceRefresh);
    const { query, results } = await searchImagesForModel(
      modelId,
      modelData,
      20, // Limit to 20 results
      forceRefresh || false // Pass forceRefresh parameter
    );

    console.log('[IMAGE SEARCH API] Search completed:', { 
      query, 
      resultsCount: results.length,
      forceRefresh 
    });

    if (results.length === 0) {
      console.warn('[IMAGE SEARCH API] No results found for query:', query);
    }

    return NextResponse.json({
      success: true,
      query,
      results: results.map((result) => ({
        url: result.link,
        thumbnail: result.image.thumbnailLink,
        title: result.title,
        source: result.displayLink,
        width: result.image.width,
        height: result.image.height,
        contextLink: result.image.contextLink,
      })),
    });
  } catch (error) {
    console.error('Error in image search API:', error);

    if (error instanceof Error) {
      // Check for specific error messages
      if (error.message.includes('API key not configured')) {
        return NextResponse.json(
          {
            error: 'API keys not configured',
            message: error.message,
            requiresSetup: true,
          },
          { status: 400 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: error.message,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to search images',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

