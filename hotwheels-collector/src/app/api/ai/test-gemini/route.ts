import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/db';

export async function GET() {
  try {
    // API key'i al
    let apiKey: string | null = null;
    
    try {
      const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' },
      });
      apiKey = setting?.value || null;
    } catch (error) {
      console.error('Error fetching Gemini API key from database:', error);
    }

    // Fallback to environment variable
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || null;
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'Gemini API key not found',
        details: 'API key is not configured in database (gemini_api_key) or environment variable (GEMINI_API_KEY)',
        apiKeyFromDB: false,
        apiKeyFromEnv: !!process.env.GEMINI_API_KEY,
      }, { status: 400 });
    }

    // API key uzunluğunu kontrol et (güvenlik için sadece uzunluk)
    const apiKeyLength = apiKey.length;
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);

    // Gemini client oluştur
    const genAI = new GoogleGenerativeAI(apiKey);

    // Önce ListModels API'sini kullanarak mevcut modelleri al
    let availableModels: string[] = [];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (response.ok) {
        const data = await response.json();
        availableModels = data.models?.map((m: any) => m.name?.replace('models/', '') || m.name) || [];
        console.log('[Test Gemini] Available models from API:', availableModels);
      }
    } catch (error) {
      console.error('[Test Gemini] Error fetching models list:', error);
    }

    // Kullanılabilir modelleri test et
    const modelsToTest = availableModels.length > 0 
      ? availableModels.filter(m => m.includes('gemini'))
      : [
          'gemini-pro',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-1.5-flash-8b',
          'gemini-1.0-pro',
          'models/gemini-pro',
          'models/gemini-1.5-pro',
          'models/gemini-1.5-flash',
        ];

    const results: Array<{
      model: string;
      available: boolean;
      error?: string;
    }> = [];

    // Her modeli test et
    for (const modelName of modelsToTest) {
      try {
        // Model adından "models/" prefix'ini kaldır
        const cleanModelName = modelName.replace('models/', '');
        const model = genAI.getGenerativeModel({ model: cleanModelName });
        // Basit bir test çağrısı yap (sadece text, görsel olmadan)
        const result = await model.generateContent('Test');
        const response = await result.response;
        const text = response.text();
        
        results.push({
          model: cleanModelName,
          available: true,
        });
      } catch (error: any) {
        results.push({
          model: modelName.replace('models/', ''),
          available: false,
          error: error?.message || 'Unknown error',
        });
      }
    }

    const workingModel = results.find(r => r.available);
    
    return NextResponse.json({
      success: true,
      apiKeyConfigured: true,
      apiKeyLength,
      apiKeyPreview,
      source: apiKey === process.env.GEMINI_API_KEY ? 'environment' : 'database',
      availableModelsFromAPI: availableModels,
      models: results,
      recommendation: workingModel?.model || 'No available models found',
      workingModel: workingModel?.model || null,
    });
  } catch (error: any) {
    console.error('[Test Gemini] Error:', error);
    return NextResponse.json({
      error: 'Failed to test Gemini API',
      details: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

