import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Gemini 2.5 Flash görüntü analizi için optimize edilmiş ve daha hızlı
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      {
        text: 'Bu görüntüyü analiz et. Hot Wheels arabası mı? Hangi model? Renk, detaylar ve özellikler neler?',
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      analysis: text,
      model: 'gemini-2.5-flash',
    });
  } catch (error) {
    console.error('Analyze error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      apiKeyExists: !!process.env.GEMINI_API_KEY,
      apiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
      apiKeyPreview: process.env.GEMINI_API_KEY?.substring(0, 10) + '...' || 'not set'
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : undefined;
    
    // API key kontrolü
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      return NextResponse.json(
        { 
          error: 'Gemini API anahtarı eksik veya geçersiz. Lütfen .env dosyasına geçerli bir GEMINI_API_KEY ekleyin.',
          details: 'API key: ' + (apiKey ? 'your-api-key-here (placeholder)' : 'not set'),
          hint: 'https://makersuite.google.com/app/apikey adresinden API key alabilirsiniz.'
        },
        { status: 401 }
      );
    }
    
    // API key hatası kontrolü
    if (errorMessage.includes('API_KEY') || errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
      return NextResponse.json(
        { 
          error: 'Gemini API anahtarı geçersiz. Lütfen .env dosyasındaki GEMINI_API_KEY değerini kontrol edin.',
          details: 'API key hatası: ' + errorMessage
        },
        { status: 401 }
      );
    }
    
    // Model adı hatası kontrolü
    if (errorMessage.includes('model') || errorMessage.includes('Model')) {
      return NextResponse.json(
        { 
          error: 'Gemini model adı hatası. Model: gemini-1.5-flash',
          details: errorMessage
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Görüntü analizi başarısız oldu', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}







