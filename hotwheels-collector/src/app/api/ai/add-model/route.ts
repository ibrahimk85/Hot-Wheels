import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

export interface AddModelRequest {
  castingName: string;
  yearId: number;
  collectionId: number;
  subSeriesId?: number;
  color?: string;
  wheelType?: string;
  castingId?: string;
  description?: string;
  specialDetails?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AddModelRequest = await request.json();
    const {
      castingName,
      yearId,
      collectionId,
      subSeriesId,
      color,
      wheelType,
      castingId,
      description,
      specialDetails,
    } = body;

    // Validasyon
    if (!castingName || castingName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Casting name is required' },
        { status: 400 }
      );
    }

    if (!yearId || !collectionId) {
      return NextResponse.json(
        { error: 'Year ID and Collection ID are required' },
        { status: 400 }
      );
    }

    // Veritabanı bütünlüğü kontrolleri
    // 1. Year kontrolü
    const year = await prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year) {
      return NextResponse.json(
        { error: 'Year not found' },
        { status: 404 }
      );
    }

    // 2. Collection kontrolü (seçilen yıla ait mi?)
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        year: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.yearId !== yearId) {
      return NextResponse.json(
        { error: 'Collection does not belong to the selected year' },
        { status: 400 }
      );
    }

    // 3. SubSeries kontrolü (opsiyonel - seçilen koleksiyona ait mi?)
    if (subSeriesId) {
      const subSeries = await prisma.subSeries.findUnique({
        where: { id: subSeriesId },
      });

      if (!subSeries) {
        return NextResponse.json(
          { error: 'SubSeries not found' },
          { status: 404 }
        );
      }

      if (subSeries.collectionId !== collectionId) {
        return NextResponse.json(
          { error: 'SubSeries does not belong to the selected collection' },
          { status: 400 }
        );
      }
    }

    // Model oluştur
    const model = await prisma.model.create({
      data: {
        castingName: castingName.trim(),
        castingId: castingId?.trim() || null,
        description: description?.trim() || null,
        collectionId,
        subSeriesId: subSeriesId || null,
        owned: false,
        quantity: 0,
        notes: specialDetails?.trim() || null,
      },
      include: {
        collection: {
          include: {
            year: true,
          },
        },
        subSeries: true,
      },
    });

    // Variant oluştur (eğer color veya wheelType varsa)
    let variant = null;
    if (color || wheelType) {
      variant = await prisma.variant.create({
        data: {
          modelId: model.id,
          year: year.year,
          color: color?.trim() || null,
          wheelType: wheelType?.trim() || null,
          owned: false,
          quantity: 0,
        },
      });
    }

    console.log('[Add Model] Model created:', {
      modelId: model.id,
      castingName: model.castingName,
      collectionId: model.collectionId,
      subSeriesId: model.subSeriesId,
      variantId: variant?.id,
    });

    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        castingName: model.castingName,
        collectionName: model.collection.name,
        year: model.collection.year.year,
        subSeriesName: model.subSeries?.name,
        variantId: variant?.id,
      },
    });
  } catch (error: any) {
    console.error('[Add Model] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to add model',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

