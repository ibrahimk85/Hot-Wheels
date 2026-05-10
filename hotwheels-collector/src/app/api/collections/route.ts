import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearId = searchParams.get('yearId');

    const where = yearId
      ? {
          yearId: parseInt(yearId),
        }
      : {};

    const collections = await prisma.collection.findMany({
      where,
      include: {
        year: true,
      },
      orderBy: [
        { yearId: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}




