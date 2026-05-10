import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageCondition } from '@/features/ai/image-recognition.service';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    // File'ı buffer'a çevir
    const arrayBuffer = await imageFile.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // HEIC/HEIF formatını kontrol et - backend'de dönüştürme desteklenmiyor
    const isHeic = imageFile.type === 'image/heic' || 
                   imageFile.type === 'image/heif' ||
                   imageFile.name.toLowerCase().endsWith('.heic') ||
                   imageFile.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
      console.log('[API] /api/ai/analyze-condition - HEIC file detected, but backend conversion is not supported');
      return NextResponse.json(
        { 
          error: 'HEIC dosyası backend\'de işlenemiyor',
          details: 'HEIC dosyaları tarayıcıda (frontend) otomatik olarak JPEG\'e dönüştürülmelidir.'
        },
        { status: 400 }
      );
    }

    // Durum analizi
    const result = await analyzeImageCondition(buffer);

    if (!result) {
      return NextResponse.json(
        { error: 'Could not analyze image condition' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analyze-condition API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze condition' },
      { status: 500 }
    );
  }
}




