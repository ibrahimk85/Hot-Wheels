import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const id = Number(modelId);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const imageIdRaw = formData.get('imageId');
    
    if (!imageIdRaw) {
      return NextResponse.json({ error: 'imageId is required' }, { status: 400 });
    }

    const imageId = Number(imageIdRaw);
    if (Number.isNaN(imageId)) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Verify model exists
    const model = await prisma.model.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Verify image exists and belongs to this model (either directly or through variant)
    const image = await prisma.image.findFirst({
      where: {
        id: imageId,
        OR: [
          { modelId: id },
          {
            variant: {
              modelId: id,
            },
          },
        ],
      },
    });

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found or does not belong to this model' },
        { status: 404 }
      );
    }

    // Update model's mainImageId
    await prisma.model.update({
      where: { id },
      data: { mainImageId: imageId },
    });

    // Revalidate collections pages to update the cache
    revalidatePath('/collections', 'layout');
    revalidatePath('/', 'layout');

    return NextResponse.json({ success: true, mainImageId: imageId });
  } catch (error) {
    console.error('Error setting main image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

