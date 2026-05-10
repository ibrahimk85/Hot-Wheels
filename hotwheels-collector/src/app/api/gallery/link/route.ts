import { NextResponse } from 'next/server';
import prisma from '@/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageId, modelId } = body;

    console.log('Link request received:', { imageId, modelId, body });

    // Validate inputs
    if (imageId === undefined || imageId === null || imageId === '') {
      return NextResponse.json(
        { error: 'imageId is required' },
        { status: 400 }
      );
    }

    if (modelId === undefined || modelId === null || modelId === '') {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    const imageIdNum = Number(imageId);
    const modelIdNum = Number(modelId);

    if (Number.isNaN(imageIdNum) || imageIdNum <= 0) {
      return NextResponse.json(
        { error: `Invalid imageId: ${imageId}` },
        { status: 400 }
      );
    }

    if (Number.isNaN(modelIdNum) || modelIdNum <= 0) {
      return NextResponse.json(
        { error: `Invalid modelId: ${modelId}` },
        { status: 400 }
      );
    }

    // Verify the image exists and is a gallery image
    const image = await prisma.image.findUnique({
      where: { id: imageIdNum },
      include: {
        model: true,
      },
    });

    if (!image) {
      console.error(`Image not found: ${imageIdNum}`);
      return NextResponse.json(
        { error: `Image not found: ${imageIdNum}` },
        { status: 404 }
      );
    }

    // Check if image is a gallery image by path
    // Gallery images are in /elite64/gallery/, /gallery/elite64/, /rlc/gallery/, or /gallery/rlc/ paths
    const isGalleryPath = image.path.includes('/elite64/gallery/') || 
                         image.path.includes('/gallery/elite64/') ||
                         image.path.includes('/rlc/gallery/') ||
                         image.path.includes('/gallery/rlc/');
    
    if (!isGalleryPath) {
      console.error(`Image ${imageIdNum} is not a gallery image (path: ${image.path})`);
      return NextResponse.json(
        { error: 'Image is not a gallery image' },
        { status: 400 }
      );
    }

    // Verify the model exists and is from Elite 64 or Red Line Club collection
    const model = await prisma.model.findUnique({
      where: { id: modelIdNum },
      include: {
        collection: true,
      },
    });

    if (!model) {
      console.error(`Model not found: ${modelIdNum}`);
      return NextResponse.json(
        { error: `Model not found: ${modelIdNum}` },
        { status: 404 }
      );
    }

    if (model.collection.name !== 'Elite 64' && model.collection.name !== 'Red Line Club') {
      console.error(`Model ${modelIdNum} is not from Elite 64 or Red Line Club collection (collection: ${model.collection.name})`);
      return NextResponse.json(
        { error: `Model must be from Elite 64 or Red Line Club collection (found: ${model.collection.name})` },
        { status: 400 }
      );
    }

    // Link the image to the model
    // The image remains in the gallery (path-based identification)
    // but it's also linked to the model
    console.log(`Linking image ${imageIdNum} to model ${modelIdNum}`);
    const updatedImage = await prisma.image.update({
      where: { id: imageIdNum },
      data: {
        modelId: modelIdNum,
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

    console.log(`Successfully linked image ${imageIdNum} to model ${modelIdNum}`);
    return NextResponse.json(updatedImage);
  } catch (error) {
    console.error('Error linking gallery image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
