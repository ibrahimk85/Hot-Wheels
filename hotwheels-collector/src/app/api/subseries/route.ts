import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: 'collectionId parameter is required' },
        { status: 400 }
      );
    }

    const subSeries = await prisma.subSeries.findMany({
      where: {
        collectionId: parseInt(collectionId),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        collectionId: true,
      },
    });

    return NextResponse.json(subSeries);
  } catch (error) {
    console.error('Error fetching subSeries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subSeries' },
      { status: 500 }
    );
  }
}







