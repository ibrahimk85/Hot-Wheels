import { NextRequest, NextResponse } from 'next/server';
import { setDefaultCollection } from '@/features/collections/multi-collection.service';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, collectionId } = body;

    if (!userId || !collectionId) {
      return NextResponse.json(
        { error: 'userId and collectionId are required' },
        { status: 400 }
      );
    }

    await setDefaultCollection(parseInt(userId), parseInt(collectionId));
    return NextResponse.json({ message: 'Default collection updated' });
  } catch (error) {
    console.error('Error setting default collection:', error);
    return NextResponse.json(
      { error: 'Failed to set default collection' },
      { status: 500 }
    );
  }
}



