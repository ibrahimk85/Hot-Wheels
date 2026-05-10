import { NextRequest, NextResponse } from 'next/server';
import { predictPrice } from '@/features/ai/price-prediction.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, timeframe } = body;

    if (!modelId || typeof modelId !== 'number') {
      return NextResponse.json(
        { error: 'modelId is required and must be a number' },
        { status: 400 }
      );
    }

    const validTimeframes = ['1month', '3months', '6months', '1year'];
    const selectedTimeframe = validTimeframes.includes(timeframe)
      ? timeframe
      : '3months';

    const result = await predictPrice(modelId, selectedTimeframe);

    if (!result) {
      return NextResponse.json(
        { error: 'Model not found or price prediction unavailable' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in predict-price API:', error);
    return NextResponse.json(
      { error: 'Failed to predict price' },
      { status: 500 }
    );
  }
}




