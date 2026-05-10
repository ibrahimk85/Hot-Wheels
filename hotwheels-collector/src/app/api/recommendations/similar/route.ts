import { NextRequest, NextResponse } from 'next/server';
import { getSimilarModels } from '@/features/recommendations/recommendation.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    const similarModels = await getSimilarModels(Number(modelId), 10);

    return NextResponse.json(similarModels);
  } catch (error) {
    console.error('Error fetching similar models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch similar models' },
      { status: 500 }
    );
  }
}




