import { NextRequest, NextResponse } from 'next/server';
import { autoCategorizeModel } from '@/features/ai/auto-categorization.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId } = body;

    if (!modelId || typeof modelId !== 'number') {
      return NextResponse.json(
        { error: 'modelId is required and must be a number' },
        { status: 400 }
      );
    }

    const result = await autoCategorizeModel(modelId);

    if (!result) {
      return NextResponse.json(
        { error: 'Model not found or could not be categorized' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in categorize API:', error);
    return NextResponse.json(
      { error: 'Failed to categorize model' },
      { status: 500 }
    );
  }
}




