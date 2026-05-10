import { NextResponse } from 'next/server';
import { getMultipacksForVariant } from '@/features/themed-multipack/themed-multipack.service';

export async function GET(
  request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  try {
    const { variantId } = await context.params;
    const id = Number(variantId);

    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Invalid variant ID' },
        { status: 400 },
      );
    }

    const multipacks = await getMultipacksForVariant(id);
    return NextResponse.json(multipacks);
  } catch (error) {
    console.error('Error fetching multipacks for variant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch multipacks for variant' },
      { status: 500 },
    );
  }
}

