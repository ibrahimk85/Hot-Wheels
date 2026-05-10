import { NextResponse } from 'next/server';
import prisma from '@/db';
import { getModelById } from '@/features/models/model.service';
import { createImage, getImageFolderPath, generateImageFileName } from '@/features/images/image.service';
import fs from 'fs';
import path from 'path';

// Disable body parsing, we need the raw body for file upload
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Get model with collection and year info
    const model = await getModelById(id);
    const collection = model.subSeries?.collection;
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Model collection not found' },
        { status: 404 }
      );
    }

    const year = collection.year.year;
    const collectionName = collection.name;
    const castingName = model.castingName;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const imageType = (formData.get('imageType') as string) || 'other';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get folder path
    const folderPath = getImageFolderPath(year, collectionName, castingName);
    const fullFolderPath = path.join(process.cwd(), 'public', folderPath);

    // Create folder if it doesn't exist
    await fs.promises.mkdir(fullFolderPath, { recursive: true });

    // Generate filename
    const fileName = generateImageFileName(
      file.name,
      imageType as 'carded' | 'loose' | 'other',
      model.toyNumber
    );

    // Full file path
    const fullFilePath = path.join(fullFolderPath, fileName);

    // Check if file already exists, if so, add timestamp to make it unique
    let finalFileName = fileName;
    if (fs.existsSync(fullFilePath)) {
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      finalFileName = `${nameWithoutExt}-${Date.now()}.${ext}`;
    }

    const finalFilePath = path.join(fullFolderPath, finalFileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.promises.writeFile(finalFilePath, buffer);

    // Create relative path for database (starts with /images)
    const relativePath = `/${folderPath}/${finalFileName}`.replace(/\\/g, '/');

    // Create image record in database
    const imageRecord = await createImage({
      path: relativePath,
      alt: `${castingName} - ${imageType}`,
      modelId: id,
    });

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        path: imageRecord.path,
        alt: imageRecord.alt,
      },
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

