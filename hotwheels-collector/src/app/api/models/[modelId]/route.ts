import { NextRequest, NextResponse } from 'next/server';
import { getModelById } from '@/features/models/model.service';
import prisma from '@/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const id = Number(modelId);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const model = await getModelById(id);

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    return NextResponse.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const id = Number(modelId);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const body = await request.json();
    const { owned, wishlisted, quantity, notes } = body;

    // Model'in var olup olmadığını kontrol et
    const existingModel = await prisma.model.findUnique({
      where: { id },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Güncelleme verilerini hazırla
    const updateData: any = {};
    if (typeof owned === 'boolean') updateData.owned = owned;
    if (typeof wishlisted === 'boolean') updateData.wishlisted = wishlisted;
    if (typeof quantity === 'number') updateData.quantity = quantity;
    if (typeof notes === 'string') updateData.notes = notes;

    // Model'i güncelle
    const updatedModel = await prisma.model.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedModel);
  } catch (error: any) {
    console.error('Error updating model:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}




