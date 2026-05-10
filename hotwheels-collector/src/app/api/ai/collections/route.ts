import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get('yearId');

    if (!yearId) {
      return NextResponse.json(
        { error: 'yearId query parameter is required' },
        { status: 400 }
      );
    }

    const yearIdNum = parseInt(yearId);
    if (isNaN(yearIdNum)) {
      return NextResponse.json(
        { error: 'Invalid yearId' },
        { status: 400 }
      );
    }

    // Year'ın var olup olmadığını kontrol et
    const year = await prisma.year.findUnique({
      where: { id: yearIdNum },
    });

    if (!year) {
      return NextResponse.json(
        { error: 'Year not found' },
        { status: 404 }
      );
    }

    const collections = await prisma.collection.findMany({
      where: {
        yearId: yearIdNum,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(collections);
  } catch (error: any) {
    console.error('[Collections API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch collections',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

