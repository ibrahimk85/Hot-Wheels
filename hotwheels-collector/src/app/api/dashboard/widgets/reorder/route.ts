import { NextRequest, NextResponse } from 'next/server';
import { reorderWidgets } from '@/features/dashboard/dashboard.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { layoutId, widgets } = body;

    if (!layoutId || !Array.isArray(widgets)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await reorderWidgets(
      layoutId,
      widgets.map((w: any) => ({ id: w.id, position: w.position }))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering widgets:', error);
    return NextResponse.json(
      { error: 'Failed to reorder widgets' },
      { status: 500 }
    );
  }
}



