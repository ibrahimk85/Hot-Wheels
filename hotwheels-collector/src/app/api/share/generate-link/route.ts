import { NextRequest, NextResponse } from 'next/server';
import { createShareLink } from '@/features/share/share.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, targetId, isPublic, expiresInDays } = body;

    console.log('Share link request:', { type, targetId, isPublic, expiresInDays });

    if (!type || !targetId) {
      return NextResponse.json(
        { error: 'type and targetId are required' },
        { status: 400 }
      );
    }

    if (!['collection', 'model', 'variant'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be collection, model, or variant' },
        { status: 400 }
      );
    }

    const shareLink = await createShareLink(
      type as 'collection' | 'model' | 'variant',
      Number(targetId),
      isPublic ?? true,
      expiresInDays ? Number(expiresInDays) : undefined
    );

    console.log('Share link created:', shareLink.shareId);

    return NextResponse.json(shareLink);
  } catch (error) {
    console.error('Error creating share link:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create share link';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

