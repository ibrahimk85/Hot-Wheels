import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/db';
import { deleteImage } from '@/features/images/image.service';
import fs from 'fs';
import path from 'path';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;
    const id = Number(imageId);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Get image info before deleting
    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete image record from database
    await deleteImage(id);

    // Optionally delete the physical file (uncomment if you want to delete files too)
    // const filePath = path.join(process.cwd(), 'public', image.path);
    // if (fs.existsSync(filePath)) {
    //   await fs.promises.unlink(filePath);
    // }

    // Revalidate collections pages
    revalidatePath('/collections', 'layout');
    revalidatePath('/', 'layout');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

