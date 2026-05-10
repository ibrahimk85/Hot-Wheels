import { NextResponse } from 'next/server';
import { getAllImages } from '@/features/images/image.service';

export async function GET() {
  try {
    const images = await getAllImages();
    return NextResponse.json(images);
  } catch (error) {
    console.error('List images error:', error);
    return NextResponse.json(
      { error: 'Failed to list images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}







