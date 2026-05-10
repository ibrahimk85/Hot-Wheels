import { NextRequest, NextResponse } from 'next/server';
import { addWidget } from '@/features/dashboard/dashboard.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { layoutId, type, position, size, config } = body;

    if (!layoutId || !type || position === undefined || !size) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const widget = await addWidget(layoutId, {
      type,
      position,
      size,
      config: config || {},
    });

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Error creating widget:', error);
    return NextResponse.json(
      { error: 'Failed to create widget' },
      { status: 500 }
    );
  }
}



