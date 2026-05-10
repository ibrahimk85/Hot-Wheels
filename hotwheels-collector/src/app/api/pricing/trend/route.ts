import { NextRequest, NextResponse } from 'next/server';
import {
  getPriceTrendForModel,
  getPriceTrendForVariant,
  getMarketAnalysis,
  comparePricesFromSources,
} from '@/features/pricing/price-tracking.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modelId = searchParams.get('modelId');
    const variantId = searchParams.get('variantId');
    const days = parseInt(searchParams.get('days') || '30');
    const type = searchParams.get('type'); // "trend", "analysis", "compare"

    if (!modelId && !variantId) {
      return NextResponse.json(
        { error: 'modelId or variantId is required' },
        { status: 400 }
      );
    }

    if (type === 'analysis') {
      const analysis = await getMarketAnalysis(
        modelId ? parseInt(modelId) : undefined,
        variantId ? parseInt(variantId) : undefined,
        days
      );
      return NextResponse.json(analysis);
    }

    if (type === 'compare') {
      const comparison = await comparePricesFromSources(
        modelId ? parseInt(modelId) : undefined,
        variantId ? parseInt(variantId) : undefined
      );
      return NextResponse.json(comparison);
    }

    // Default: trend
    let trends;
    if (variantId) {
      trends = await getPriceTrendForVariant(parseInt(variantId), days);
    } else if (modelId) {
      trends = await getPriceTrendForModel(parseInt(modelId), days);
    } else {
      return NextResponse.json(
        { error: 'modelId or variantId is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(trends);
  } catch (error) {
    console.error('Error fetching price trend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price trend' },
      { status: 500 }
    );
  }
}



