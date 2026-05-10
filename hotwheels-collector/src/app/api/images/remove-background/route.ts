import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const threshold = parseInt(formData.get('threshold') as string) || 240;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Remove white background using threshold
    const processedImage = await sharp(buffer)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from(
            await sharp(buffer)
              .greyscale()
              .threshold(threshold)
              .toBuffer()
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    const base64 = processedImage.toString('base64');
    const imageData = `data:image/png;base64,${base64}`;

    return NextResponse.json({
      success: true,
      imageData,
    });
  } catch (error) {
    console.error('Remove background error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove background', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}







