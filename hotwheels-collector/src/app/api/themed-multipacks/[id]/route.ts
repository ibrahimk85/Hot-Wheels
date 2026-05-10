import { NextResponse } from 'next/server';
import { getThemedMultipackById } from '@/features/themed-multipack/themed-multipack.service';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { error: 'Invalid themed multipack ID' },
        { status: 400 },
      );
    }

    const multipack = await getThemedMultipackById(numericId);
    return NextResponse.json(multipack);
  } catch (error) {
    console.error('Error fetching themed multipack:', error);
    return NextResponse.json(
      { error: 'Failed to fetch themed multipack' },
      { status: 500 },
    );
  }
}

