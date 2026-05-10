import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optimize image: resize to max 1200px width, compress
    const optimizedImage = await sharp(buffer)
      .resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();

    const base64 = optimizedImage.toString('base64');
    const imageData = `data:image/png;base64,${base64}`;

    return NextResponse.json({
      success: true,
      imageData,
    });
  } catch (error) {
    console.error('Optimize error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to optimize image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}







