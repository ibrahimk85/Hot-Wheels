import { NextRequest, NextResponse } from 'next/server';
import {
  createPriceAlert,
  getUserPriceAlerts,
} from '@/features/pricing/price-alert.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const alerts = await getUserPriceAlerts(parseInt(userId), activeOnly);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, variantId, modelId, targetPrice, condition } = body;

    if (!targetPrice || !condition) {
      return NextResponse.json(
        { error: 'targetPrice and condition are required' },
        { status: 400 }
      );
    }

    if (!variantId && !modelId) {
      return NextResponse.json(
        { error: 'variantId or modelId is required' },
        { status: 400 }
      );
    }

    const alert = await createPriceAlert({
      userId: userId ? parseInt(userId) : undefined,
      variantId: variantId ? parseInt(variantId) : undefined,
      modelId: modelId ? parseInt(modelId) : undefined,
      targetPrice: parseFloat(targetPrice),
      condition,
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Error creating price alert:', error);
    return NextResponse.json(
      { error: 'Failed to create price alert' },
      { status: 500 }
    );
  }
}



