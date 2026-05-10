import { NextRequest, NextResponse } from 'next/server';
import { mergeModels } from '@/features/data-management/duplicate-detection.service';

export async function POST(request: NextRequest) {
  try {
    const { keepId, mergeIds } = await request.json();

    if (!keepId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: keepId and mergeIds required' },
        { status: 400 }
      );
    }

    const result = await mergeModels(keepId, mergeIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json(
      { error: 'Merge failed' },
      { status: 500 }
    );
  }
}



