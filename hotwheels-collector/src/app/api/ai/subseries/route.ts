import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: 'collectionId query parameter is required' },
        { status: 400 }
      );
    }

    const collectionIdNum = parseInt(collectionId);
    if (isNaN(collectionIdNum)) {
      return NextResponse.json(
        { error: 'Invalid collectionId' },
        { status: 400 }
      );
    }

    // Collection'ın var olup olmadığını kontrol et
    const collection = await prisma.collection.findUnique({
      where: { id: collectionIdNum },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    const subSeries = await prisma.subSeries.findMany({
      where: {
        collectionId: collectionIdNum,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(subSeries);
  } catch (error: any) {
    console.error('[SubSeries API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch subseries',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

