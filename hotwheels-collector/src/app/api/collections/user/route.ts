import { NextRequest, NextResponse } from 'next/server';
import { getUserCollections, addCollectionToUser, removeCollectionFromUser } from '@/features/collections/multi-collection.service';
import { apiHandler } from '@/lib/api-handler';
import { withAuth } from '@/lib/auth';

export const GET = apiHandler(
  withAuth(async (user, request) => {
    // Use authenticated user's ID instead of query parameter
    const collections = await getUserCollections(user.id);
    return NextResponse.json(collections);
  })
);

export const POST = apiHandler(
  withAuth(async (user, request) => {
    const body = await request.json();
    const { collectionId, isDefault } = body;

    if (!collectionId) {
      throw new Error('collectionId is required');
    }

    // Use authenticated user's ID
    const userCollection = await addCollectionToUser(
      user.id,
      parseInt(collectionId),
      isDefault || false
    );

    return NextResponse.json(userCollection, { status: 201 });
  })
);

export const DELETE = apiHandler(
  withAuth(async (user, request) => {
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      throw new Error('collectionId is required');
    }

    // Use authenticated user's ID
    await removeCollectionFromUser(
      user.id,
      parseInt(collectionId)
    );

    return NextResponse.json({ message: 'Collection removed from user' });
  })
);

