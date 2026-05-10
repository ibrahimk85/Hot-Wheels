import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const castingId = searchParams.get('castingId');
    const castingName = searchParams.get('castingName');

    if (!castingId && !castingName) {
      return NextResponse.json(
        { error: 'castingId or castingName is required' },
        { status: 400 }
      );
    }

    let model = null;

    // Önce castingId ile ara
    if (castingId) {
      model = await prisma.model.findFirst({
        where: {
          castingId: castingId,
        },
        select: {
          id: true,
          castingName: true,
        },
      });
    }

    // Eğer castingId ile bulunamadıysa, castingName ile ara
    if (!model && castingName) {
      model = await prisma.model.findFirst({
        where: {
          castingName: {
            contains: castingName,
          },
        },
        select: {
          id: true,
          castingName: true,
        },
        orderBy: {
          id: 'desc', // En yeni modeli al
        },
      });
    }

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ modelId: model.id });
  } catch (error) {
    console.error('Error finding model:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

