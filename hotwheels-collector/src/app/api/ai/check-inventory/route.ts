import { NextRequest, NextResponse } from 'next/server';
import { findBestMatch } from '@/features/ai/fuzzy-matching.service';
import prisma from '@/db';

export interface InventoryCheckRequest {
  modelName: string;
  year?: number;
  collection?: string;
  subSeries?: string;
  color?: string;
}

export interface InventoryCheckResponse {
  found: boolean;
  model?: {
    id: number;
    castingName: string;
    castingId: string | null;
    collectionName: string;
    year: number;
    subSeriesName?: string;
    owned: boolean;
    variants?: Array<{
      id: number;
      year: number;
      color: string | null;
      owned: boolean;
      quantity: number;
    }>;
  };
  similarity?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: InventoryCheckRequest = await request.json();
    const { modelName, year, collection, subSeries, color } = body;

    if (!modelName || modelName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Model name is required' },
        { status: 400 }
      );
    }

    console.log('[Inventory Check] Searching for model:', {
      modelName,
      year,
      collection,
      subSeries,
      color,
    });

    // Fuzzy match ile model bul
    const bestMatch = await findBestMatch(modelName, {
      threshold: 0.3,
      includeDetails: true,
    });

    if (!bestMatch) {
      console.log('[Inventory Check] No match found');
      return NextResponse.json({
        found: false,
      });
    }

    console.log('[Inventory Check] Best match found:', {
      id: bestMatch.id,
      name: bestMatch.castingName,
      similarity: bestMatch.similarity,
    });

    // Model detaylarını al
    const model = await prisma.model.findUnique({
      where: { id: bestMatch.id },
      include: {
        collection: {
          include: {
            year: true,
          },
        },
        subSeries: true,
        variants: {
          select: {
            id: true,
            year: true,
            color: true,
            owned: true,
            quantity: true,
          },
          orderBy: {
            year: 'desc',
          },
        },
      },
    });

    if (!model) {
      return NextResponse.json({
        found: false,
      });
    }

    // Ek filtreleme (opsiyonel - eğer year, collection, color belirtilmişse)
    let matched = true;
    if (year && model.collection.year.year !== year) {
      matched = false;
    }
    if (collection && model.collection.name !== collection) {
      matched = false;
    }
    if (subSeries && model.subSeries?.name !== subSeries) {
      matched = false;
    }

    // Color filtreleme (variant seviyesinde)
    let relevantVariants = model.variants;
    if (color && relevantVariants.length > 0) {
      const colorMatch = relevantVariants.find(
        v => v.color?.toLowerCase().includes(color.toLowerCase())
      );
      if (!colorMatch) {
        // Color eşleşmezse, yine de model bulundu sayılır ama variant yok
        relevantVariants = [];
      } else {
        relevantVariants = [colorMatch];
      }
    }

    const response: InventoryCheckResponse = {
      found: matched,
      model: {
        id: model.id,
        castingName: model.castingName,
        castingId: model.castingId,
        collectionName: model.collection.name,
        year: model.collection.year.year,
        subSeriesName: model.subSeries?.name,
        owned: model.owned,
        variants: relevantVariants.map(v => ({
          id: v.id,
          year: v.year,
          color: v.color,
          owned: v.owned,
          quantity: v.quantity,
        })),
      },
      similarity: bestMatch.similarity,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Inventory Check] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check inventory',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

