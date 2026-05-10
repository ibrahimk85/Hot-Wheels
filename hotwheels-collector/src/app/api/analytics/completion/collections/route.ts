import { NextRequest, NextResponse } from 'next/server';
import { getCollectionCompletion } from '@/features/analytics/completion.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collectionId');

    const completion = await getCollectionCompletion(
      collectionId ? parseInt(collectionId) : undefined
    );
    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error fetching collection completion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection completion' },
      { status: 500 }
    );
  }
}



