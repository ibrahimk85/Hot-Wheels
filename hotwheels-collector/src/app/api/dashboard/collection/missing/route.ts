import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5');

    const models = await prisma.model.findMany({
      where: { owned: false },
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        subSeries: {
          include: {
            collection: {
              include: {
                year: true,
              },
            },
          },
        },
      },
    });

    const data = models.map((model) => ({
      id: model.id,
      name: model.castingName,
      collectionName: model.subSeries?.collection.name,
      year: model.subSeries?.collection.year.year,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching missing collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing collection' },
      { status: 500 }
    );
  }
}



