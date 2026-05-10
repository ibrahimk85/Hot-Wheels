import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import { getMarketPrice } from '@/features/analytics/price-helper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5');

    const models = await prisma.model.findMany({
      where: {
        owned: false,
        OR: [
          { packedPrice: { gt: 100 } },
          { loosePrice: { gt: 100 } },
          { packedMarketPrice: { gt: 100 } },
          { looseMarketPrice: { gt: 100 } },
        ],
      },
      orderBy: [
        { packedMarketPrice: 'desc' },
        { looseMarketPrice: 'desc' },
        { packedPrice: 'desc' },
        { loosePrice: 'desc' },
      ],
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
      value: getMarketPrice(model),
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching valuable collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch valuable collection' },
      { status: 500 }
    );
  }
}



