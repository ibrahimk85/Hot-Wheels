import { NextResponse } from 'next/server';
import prisma from '@/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId is required' },
        { status: 400 }
      );
    }

    // Verify the image exists and is a gallery image
    const image = await prisma.image.findUnique({
      where: { id: Number(imageId) },
    });

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Check if image is a gallery image by path (for both Elite64 and RLC)
    const isGalleryPath = image.path.includes('/elite64/gallery/') || 
                         image.path.includes('/gallery/elite64/') ||
                         image.path.includes('/rlc/gallery/') ||
                         image.path.includes('/gallery/rlc/');
    
    if (!isGalleryPath && !image.isGalleryImage) {
      return NextResponse.json(
        { error: 'Image is not a gallery image' },
        { status: 400 }
      );
    }

    // Unlink the image from the model
    // Keep isGalleryImage=true so it remains in the gallery
    const updatedImage = await prisma.image.update({
      where: { id: Number(imageId) },
      data: {
        modelId: null,
        variantId: null,
        // Keep isGalleryImage=true
        isGalleryImage: true,
      },
      include: {
        model: {
          include: {
            collection: {
              include: {
                year: true,
              },
            },
            subSeries: true,
          },
        },
      },
    });

    return NextResponse.json(updatedImage);
  } catch (error) {
    console.error('Error unlinking gallery image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

