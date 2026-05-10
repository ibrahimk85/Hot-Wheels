import { NextRequest, NextResponse } from 'next/server';
import {
  updatePriceAlert,
  deletePriceAlert,
} from '@/features/pricing/price-alert.service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { targetPrice, condition, active } = body;

    const alert = await updatePriceAlert(parseInt(id), {
      targetPrice,
      condition,
      active,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error updating price alert:', error);
    return NextResponse.json(
      { error: 'Failed to update price alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deletePriceAlert(parseInt(id));
    return NextResponse.json({ message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting price alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete price alert' },
      { status: 500 }
    );
  }
}



