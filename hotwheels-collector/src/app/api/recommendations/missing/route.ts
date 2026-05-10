import { NextRequest, NextResponse } from 'next/server';
import {
  getMissingModelsInSubSeries,
  getMissingModelsInCollection,
} from '@/features/recommendations/recommendation.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subSeriesId = searchParams.get('subSeriesId');
    const collectionId = searchParams.get('collectionId');

    if (!subSeriesId && !collectionId) {
      return NextResponse.json(
        { error: 'subSeriesId or collectionId is required' },
        { status: 400 }
      );
    }

    let missingModels;

    if (subSeriesId) {
      missingModels = await getMissingModelsInSubSeries(Number(subSeriesId));
    } else if (collectionId) {
      missingModels = await getMissingModelsInCollection(Number(collectionId));
    } else {
      return NextResponse.json(
        { error: 'subSeriesId or collectionId is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(missingModels);
  } catch (error) {
    console.error('Error fetching missing models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing models' },
      { status: 500 }
    );
  }
}




