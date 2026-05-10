import prisma from '@/db';
import { getOpenAIClient } from './chatbot.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Vision API REST endpoint
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

let cachedGoogleApiKey: string | null = null;
let cachedGeminiApiKey: string | null = null;

async function getGoogleVisionApiKey(): Promise<string | null> {
  // First try to get from database
  let apiKey: string | null = null;
  
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'google_lens_api_key' },
    });
    apiKey = setting?.value || null;
  } catch (error) {
    console.error('Error fetching Google Vision API key from database:', error);
  }

  // Fallback to environment variable if not in database
  if (!apiKey) {
    apiKey = process.env.GOOGLE_VISION_API_KEY || null;
  }

  if (!apiKey) {
    console.warn('Google Vision API key not configured');
    return null;
  }

  cachedGoogleApiKey = apiKey;
  return apiKey;
}

async function getGeminiApiKey(): Promise<string | null> {
  // First try to get from database
  let apiKey: string | null = null;
  let source = 'none';
  
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'gemini_api_key' },
    });
    apiKey = setting?.value || null;
    if (apiKey) {
      source = 'database';
      console.log('[Gemini API Key] Found in database, length:', apiKey.length);
    }
  } catch (error) {
    console.error('[Gemini API Key] Error fetching from database:', error);
  }

  // Fallback to environment variable if not in database
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || null;
    if (apiKey) {
      source = 'environment';
      console.log('[Gemini API Key] Found in environment, length:', apiKey.length);
    }
  }

  if (!apiKey) {
    console.warn('[Gemini API Key] Not configured in database or environment');
    return null;
  }

  // API key format kontrolü (Google API key'ler genellikle "AIza" ile başlar)
  if (!apiKey.startsWith('AIza')) {
    console.warn('[Gemini API Key] API key format may be incorrect (should start with "AIza")');
  }

  console.log('[Gemini API Key] Using API key from:', source, 'length:', apiKey.length);
  cachedGeminiApiKey = apiKey;
  return apiKey;
}

export interface RecognitionResult {
  modelName: string;
  confidence: number;
  details?: {
    color?: string;
    year?: number;
    series?: string;
    subSeries?: string;
    castingName?: string;
    castingId?: string;
    wheelType?: string;
    specialDetails?: string; // Özel detaylar (grafikler, yazılar - örn: "428 C.I.")
  };
}

/**
 * OpenAI Vision API ile görselden model tanıma (görsel analizi)
 */
async function recognizeModelFromImageWithOpenAI(
  imageBuffer: Buffer
): Promise<RecognitionResult | null> {
  const client = await getOpenAIClient();
  if (!client) {
    console.log('[OpenAI Vision] OpenAI client not available');
    return null;
  }

  try {
    console.log('[OpenAI Vision] Starting image recognition...');
    
    // Base64 encode
    const imageBase64 = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

    // Veritabanından örnek model adlarını al (referans için - performans için limitli)
    const sampleModels = await prisma.model.findMany({
      take: 300, // Daha fazla örnek
      select: {
        castingName: true,
        description: true,
      },
      orderBy: {
        id: 'desc', // En yeni modeller
      },
    });

    const modelNames = sampleModels.map(m => m.castingName).join(', ');

    // İyileştirilmiş prompt
    const openAIPrompt = `Sen bir Hot Wheels uzmanısın. Bu görseldeki Hot Wheels modelini tanımla.

GÖRSEL ANALİZİ:
1. Arabanın şeklini, tasarımını ve özelliklerini detaylıca analiz et
2. Görselde yazı varsa (model adı, casting name, seri numarası) onları oku
3. Arabanın rengini ve özel detaylarını belirle (jantlar, spoiler, açık/kapalı tavan vb.)

VERİTABANI REFERANSLARI:
Bilinen Hot Wheels modellerinden örnekler: ${modelNames.substring(0, 2000)}...

YANIT FORMATI (Türkçe):
- Model Adı: [kesin model adı - eğer belirleyemiyorsan "Belirleyemiyorum" yazma, en yakın tahmini yaz]
- Renk: [renk]
- Özellikler: [özellikler]
- Güven: [yüksek/orta/düşük]

ÖNEMLİ: Eğer model adını kesin belirleyemiyorsan, görseldeki arabanın özelliklerine göre en olası model adını tahmin et. "Belirleyemiyorum" demek yerine, görsel analizine dayanarak bir tahmin yap.`;

    // OpenAI Vision API ile görsel analizi
    const completion = await client.chat.completions.create({
      model: 'gpt-4o', // GPT-4o vision desteği var
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: openAIPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    console.log('[OpenAI Vision] Response:', response);

    // Response'dan bilgileri çıkar
    const modelNameMatch = response.match(/Model Adı:\s*(.+?)(?:\n|$)/i);
    const colorMatch = response.match(/Renk:\s*(.+?)(?:\n|$)/i);
    const confidenceMatch = response.match(/Güven:\s*(.+?)(?:\n|$)/i);

    if (!modelNameMatch) {
      console.log('[OpenAI Vision] Could not extract model name from response');
      return null;
    }

    const extractedModelName = modelNameMatch[1].trim();
    console.log('[OpenAI Vision] Extracted model name:', extractedModelName);
    
    // İyileştirilmiş veritabanı arama
    const bestMatch = await searchModelsInDatabase(extractedModelName);
    
    console.log('[OpenAI Vision] Found models in database:', bestMatch ? 1 : 0);

    let confidence = 0.7;
    if (confidenceMatch) {
      const confText = confidenceMatch[1].toLowerCase();
      if (confText.includes('yüksek')) confidence = 0.9;
      else if (confText.includes('orta')) confidence = 0.7;
      else confidence = 0.5;
    }

    if (bestMatch) {
      console.log('[OpenAI Vision] Best match:', bestMatch.castingName);
      
      return {
        modelName: bestMatch.castingName,
        confidence,
        details: {
          castingName: bestMatch.castingName,
          castingId: bestMatch.castingId || undefined,
          color: colorMatch?.[1]?.trim(),
        },
      };
    }

    // Eğer veritabanında bulunamazsa, OpenAI'nin önerdiği model adını döndür
    console.log('[OpenAI Vision] Model not found in database, returning extracted name');
    return {
      modelName: extractedModelName,
      confidence: confidence * 0.8, // Veritabanında yoksa confidence düşür
      details: {
        color: colorMatch?.[1]?.trim(),
      },
    };
  } catch (error: any) {
    console.error('[OpenAI Vision] Error:', error);
    console.error('[OpenAI Vision] Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
    });
    return null;
  }
}

/**
 * Gemini Vision API ile görselden model tanıma
 */
/**
 * Image formatını buffer'dan tespit et
 */
function getImageMimeType(buffer: Buffer): string {
  // Magic number'lara göre format tespiti
  if (buffer.length >= 2) {
    // JPEG: FF D8
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: RIFF...WEBP
    if (buffer.length >= 12 && 
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
  }
  // Default olarak JPEG döndür
  return 'image/jpeg';
}

async function recognizeModelFromImageWithGemini(
  imageBuffer: Buffer
): Promise<RecognitionResult | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    console.log('[Gemini Vision] Gemini API key not available');
    return null;
  }

  try {
    console.log('[Gemini Vision] ===== Starting image recognition =====');
    console.log('[Gemini Vision] API key length:', apiKey.length, 'starts with:', apiKey.substring(0, 4));
    console.log('[Gemini Vision] Image buffer size:', imageBuffer.length, 'bytes');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Image formatını tespit et
    const mimeType = getImageMimeType(imageBuffer);
    console.log('[Gemini Vision] Detected image format:', mimeType);
    
    // Base64 encode
    const imageBase64 = imageBuffer.toString('base64');
    console.log('[Gemini Vision] Image base64 length:', imageBase64.length, 'characters');
    
    // ÇOK DAHA BASİT VE DOĞAL PROMPT - Gemini web sitesindeki gibi
    // Format zorlaması yok, sadece doğal soru
    const prompt = `What is this Hot Wheels toy car? Look at the image carefully and tell me:

1. What is the exact model name? Read any text or numbers visible on the car.
2. What year is it? (if visible)
3. What collection or series is it from? (Mainline, Premium, Car Culture, RLC, etc.)
4. What subseries is it? (if any, like Fast & Furious, Muscle Mania, etc.)
5. What color is it?
6. What type of wheels does it have?

Please be specific and accurate. If you see numbers like "67" or "428" on the car, include them in the model name.`;

    // Model seçimi - görsel analiz için en iyi modeller
    // gemini-1.5-flash görsel analizde daha iyi sonuçlar verebilir
    const modelsToTry = [
      'gemini-1.5-flash',           // Görsel analiz için optimize edilmiş
      'gemini-2.5-flash',           // En stabil ve çalışan model
      'gemini-flash-latest',         // Latest stable
      'gemini-2.5-flash-lite',      // Lightweight backup
    ];
    let lastError: any = null;
    let response: string | null = null;
    let usedModel: string | null = null;
    
    // Model konfigürasyonu - görsel analiz için optimize edilmiş
    // Düşük temperature = daha deterministik ve doğru sonuçlar
    const generationConfig = {
      temperature: 0.1,  // Çok düşük - deterministik sonuçlar için
      topP: 0.8,        // Daha dar token seçimi
      topK: 20,         // Daha az seçenek = daha doğru
      maxOutputTokens: 500, // Kısa ve öz yanıtlar
    };

    const safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ];
    
    for (const modelName of modelsToTry) {
      try {
        console.log('[Gemini Vision] Trying model:', modelName);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig,
          safetySettings,
        });

        // Image ÖNCE, text SONRA - Gemini'nin doğal akışı
        // Görseli önce göster, sonra soru sor - daha iyi sonuçlar
        const result = await model.generateContent([
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ]);

        response = result.response.text();
        usedModel = modelName;
        
        // Detaylı response analizi
        let tokenUsage = null;
        try {
          if (result.response && typeof result.response.usageMetadata === 'function') {
            const responseMetadata = result.response.usageMetadata();
            tokenUsage = {
              promptTokens: responseMetadata?.promptTokenCount || 'N/A',
              candidatesTokens: responseMetadata?.candidatesTokenCount || 'N/A',
              totalTokens: responseMetadata?.totalTokenCount || 'N/A',
            };
          }
        } catch (metadataError) {
          // usageMetadata bazı modellerde mevcut değil, hata verme
          console.log('[Gemini Vision] usageMetadata not available for model:', modelName);
        }
        
        console.log('[Gemini Vision] ===== Success with model:', modelName, '=====');
        console.log('[Gemini Vision] Raw response length:', response.length, 'characters');
        if (tokenUsage) {
          console.log('[Gemini Vision] Token usage:', tokenUsage);
        }
        console.log('[Gemini Vision] Response preview (first 300 chars):', response.substring(0, 300));
        console.log('[Gemini Vision] Response preview (last 200 chars):', response.substring(Math.max(0, response.length - 200)));
        break; // Başarılı oldu, döngüden çık
      } catch (modelError: any) {
        console.log('[Gemini Vision] Model', modelName, 'failed:', modelError?.message);
        lastError = modelError;
        // Bir sonraki modeli dene
        continue;
      }
    }

    if (!response) {
      console.error('[Gemini Vision] All models failed. Last error:', lastError);
      throw lastError || new Error('All Gemini models failed');
    }

    // Çoklu parsing stratejisi - daha robust
    let parsedData: any = null;
    let parsingStrategy = 'unknown';
    
    // Strateji 1: JSON format (```json veya {})
    try {
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        response.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1]);
        parsingStrategy = 'json';
        console.log('[Gemini Vision] Parsed using JSON strategy');
      }
    } catch (jsonError) {
      // JSON parsing başarısız, diğer stratejilere geç
    }
    
    // Strateji 2: Yapılandırılmış text format (Model Name:, Year:, vb.)
    if (!parsedData) {
      try {
        const extractField = (fieldName: string, altNames?: string[]): string | null => {
          const patterns = [
            new RegExp(`${fieldName}:\\s*(.+?)(?:\\n|$)`, 'i'),
            ...(altNames || []).map(name => new RegExp(`${name}:\\s*(.+?)(?:\\n|$)`, 'i')),
          ];
          
          for (const pattern of patterns) {
            const match = response.match(pattern);
            if (match && match[1]) {
              const value = match[1].trim();
              if (value && value.toLowerCase() !== 'unknown' && value.toLowerCase() !== 'none') {
                return value;
              }
            }
          }
          return null;
        };
        
        const modelName = extractField('Model Name', ['Model', 'Casting Name', 'Model Name']);
        if (modelName) {
          parsedData = {
            modelName: modelName,
            year: extractField('Year') || null,
            collection: extractField('Collection', ['Series', 'Collection/Series']) || null,
            subSeries: extractField('SubSeries', ['Sub Series', 'SubSeries']) || null,
            color: extractField('Color') || null,
            wheelType: extractField('Wheel Type', ['Wheels', 'Wheel Type']) || null,
            specialDetails: extractField('Special Details', ['Details', 'Special']) || null,
          };
          parsingStrategy = 'structured_text';
          console.log('[Gemini Vision] Parsed using structured text strategy');
        }
      } catch (textError) {
        console.error('[Gemini Vision] Structured text parsing error:', textError);
      }
    }
    
    // Strateji 3: Doğal dil parsing (fallback - basit regex extraction)
    if (!parsedData) {
      try {
        // Model adını bul - çeşitli pattern'ler dene
        const modelPatterns = [
          /(?:model|name|casting)[\s:]+(.+?)(?:\n|year|collection|$)/i,
          /(?:is|this|a|the)[\s]+(.+?)(?:\n|year|collection|$)/i,
          /^(.+?)(?:\n|year|collection|$)/i,
        ];
        
        let modelName: string | null = null;
        for (const pattern of modelPatterns) {
          const match = response.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim();
            if (candidate.length > 3 && candidate.length < 100) {
              modelName = candidate;
              break;
            }
          }
        }
        
        if (modelName) {
          parsedData = {
            modelName: modelName,
            year: response.match(/(?:year|yıl)[\s:]*(\d{4})/i)?.[1] || null,
            collection: response.match(/(?:collection|series)[\s:]+(.+?)(?:\n|$)/i)?.[1]?.trim() || null,
            color: response.match(/(?:color|renk)[\s:]+(.+?)(?:\n|$)/i)?.[1]?.trim() || null,
          };
          parsingStrategy = 'natural_language';
          console.log('[Gemini Vision] Parsed using natural language strategy');
        }
      } catch (nlError) {
        console.error('[Gemini Vision] Natural language parsing error:', nlError);
      }
    }
    
    // Strateji 4: Eski format (Türkçe) - backward compatibility
    if (!parsedData) {
      try {
        const modelNameMatch = response.match(/(?:Model Adı|Model Name):\s*(.+?)(?:\n|$)/i);
        if (modelNameMatch && modelNameMatch[1]) {
          const modelName = modelNameMatch[1].trim();
          if (modelName && !modelName.toLowerCase().includes('belirleyemiyorum')) {
            parsedData = {
              modelName: modelName,
              color: response.match(/(?:Renk|Color):\s*(.+?)(?:\n|$)/i)?.[1]?.trim() || null,
              year: response.match(/(?:Yıl|Year):\s*(\d{4})/i)?.[1] || null,
            };
            parsingStrategy = 'legacy_turkish';
            console.log('[Gemini Vision] Parsed using legacy Turkish format');
          }
        }
      } catch (legacyError) {
        console.error('[Gemini Vision] Legacy parsing error:', legacyError);
      }
    }
    
    console.log('[Gemini Vision] ===== Parsing Results =====');
    console.log('[Gemini Vision] Parsing strategy used:', parsingStrategy);
    console.log('[Gemini Vision] Parsed data keys:', Object.keys(parsedData || {}));
    
    if (!parsedData || !parsedData.modelName) {
      console.log('[Gemini Vision] ❌ No valid model name found after all parsing strategies');
      console.log('[Gemini Vision] Raw response for debugging:', response);
      console.log('[Gemini Vision] Response length:', response.length);
      return null;
    }

    // Model adını temizle ve normalize et
    let extractedModelName = parsedData.modelName.trim();
    
    // "unknown", "none", "null" gibi değerleri filtrele
    if (extractedModelName.toLowerCase() === 'unknown' || 
        extractedModelName.toLowerCase() === 'none' || 
        extractedModelName.toLowerCase() === 'null' ||
        extractedModelName.length < 2) {
      console.log('[Gemini Vision] Invalid model name:', extractedModelName);
      return null;
    }
    
    // Tırnak işaretlerini temizle
    extractedModelName = extractedModelName.replace(/^["']|["']$/g, '');
    
    console.log('[Gemini Vision] ===== Extracted Information =====');
    console.log('[Gemini Vision] Model Name:', extractedModelName);
    console.log('[Gemini Vision] Year:', parsedData.year || 'not found');
    console.log('[Gemini Vision] Collection:', parsedData.collection || 'not found');
    console.log('[Gemini Vision] SubSeries:', parsedData.subSeries || 'not found');
    console.log('[Gemini Vision] Color:', parsedData.color || 'not found');
    console.log('[Gemini Vision] Wheel Type:', parsedData.wheelType || 'not found');
    console.log('[Gemini Vision] Full parsed data:', JSON.stringify(parsedData, null, 2));
    
    // Veritabanında model ara - fuzzy matching ile
    console.log('[Gemini Vision] ===== Database Search =====');
    const searchStartTime = Date.now();
    const bestMatch = await searchModelsInDatabase(extractedModelName);
    const searchDuration = Date.now() - searchStartTime;
    
    console.log('[Gemini Vision] Database search completed in', searchDuration, 'ms');
    console.log('[Gemini Vision] Database search result:', bestMatch ? {
      id: bestMatch.id,
      name: bestMatch.castingName,
      castingId: bestMatch.castingId,
      matchType: 'found',
    } : {
      matchType: 'not found',
      searchedFor: extractedModelName,
    });

    // Confidence hesaplama - daha detaylı
    let confidence = 0.7;
    let confidenceSource = 'default';
    
    if (parsedData.confidence) {
      const confText = parsedData.confidence.toLowerCase();
      if (confText.includes('yüksek') || confText.includes('high')) {
        confidence = 0.9;
        confidenceSource = 'parsed_high';
      } else if (confText.includes('orta') || confText.includes('medium')) {
        confidence = 0.7;
        confidenceSource = 'parsed_medium';
      } else if (confText.includes('düşük') || confText.includes('low')) {
        confidence = 0.5;
        confidenceSource = 'parsed_low';
      }
    }
    
    // Veritabanında bulunduysa confidence artır
    if (bestMatch) {
      confidence = Math.min(0.95, confidence + 0.1);
      confidenceSource = 'database_match';
    }
    
    console.log('[Gemini Vision] Confidence:', confidence, 'source:', confidenceSource);

    // Details objesi oluştur - "unknown" ve "none" değerlerini filtrele
    const cleanValue = (value: any): string | number | undefined => {
      if (!value) return undefined;
      const str = String(value).trim().toLowerCase();
      if (str === 'unknown' || str === 'none' || str === 'null' || str === '') {
        return undefined;
      }
      return value;
    };

    const details: RecognitionResult['details'] = {
      castingName: bestMatch?.castingName || extractedModelName,
      castingId: bestMatch?.castingId || undefined,
      color: cleanValue(parsedData.color) as string | undefined,
      year: parsedData.year && parsedData.year !== 'null' && parsedData.year !== 'unknown' 
        ? parseInt(String(parsedData.year)) 
        : undefined,
      series: cleanValue(parsedData.collection) as string | undefined,
      subSeries: cleanValue(parsedData.subSeries) as string | undefined,
      wheelType: cleanValue(parsedData.wheelType) as string | undefined,
      specialDetails: cleanValue(parsedData.specialDetails) as string | undefined,
    };

    // Eğer veritabanında bulunduysa, veritabanındaki ismi kullan
    if (bestMatch) {
      console.log('[Gemini Vision] ===== Final Result (Database Match) =====');
      console.log('[Gemini Vision] ✅ Best match found in database:', bestMatch.castingName);
      console.log('[Gemini Vision] Confidence:', confidence);
      console.log('[Gemini Vision] Details:', JSON.stringify(details, null, 2));
      
      return {
        modelName: bestMatch.castingName, // Veritabanındaki ismi kullan
        confidence,
        details: {
          ...details,
          castingId: bestMatch.castingId || undefined,
        },
      };
    }

    // Veritabanında bulunamadı, Gemini'nin bulduğu ismi döndür
    console.log('[Gemini Vision] ===== Final Result (Gemini Only) =====');
    console.log('[Gemini Vision] ⚠️ Model not found in database, returning Gemini result');
    console.log('[Gemini Vision] Model Name:', extractedModelName);
    console.log('[Gemini Vision] Confidence (reduced):', confidence * 0.8);
    console.log('[Gemini Vision] Details:', JSON.stringify(details, null, 2));
    
    return {
      modelName: extractedModelName,
      confidence: confidence * 0.8, // Veritabanında yoksa confidence düşür
      details,
    };
  } catch (error: any) {
    console.error('[Gemini Vision] Error:', error);
    console.error('[Gemini Vision] Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
    });
    
    // Model bulunamadı hatası
    if (error?.message?.includes('not found') || error?.status === 404) {
      console.error('[Gemini Vision] Model not found. Available models: gemini-pro, gemini-1.5-pro, gemini-1.5-flash');
      console.error('[Gemini Vision] Please check your Gemini API key has access to the model.');
    }
    
    return null;
  }
}

/**
 * Veritabanında model arama (optimize edilmiş fuzzy search - Levenshtein distance ile)
 */
async function searchModelsInDatabase(extractedName: string): Promise<{
  id: number;
  castingName: string;
  castingId: string | null;
} | null> {
  const normalizedName = extractedName.toLowerCase().trim();
  
  // 1. Exact match (case insensitive) - SQLite için manuel lowercase karşılaştırma
  const allModels = await prisma.model.findMany({
    select: {
      id: true,
      castingName: true,
      castingId: true,
    },
  });
  
  const exactMatch = allModels.find(
    m => m.castingName.toLowerCase() === normalizedName
  ) || null;

  if (exactMatch) {
    console.log('[DB Search] Exact match found:', exactMatch.castingName);
    return exactMatch;
  }

  // 2. Contains match (tam string içinde geçiyor mu) - SQLite için manuel arama
  const containsMatch = allModels.find(
    m => m.castingName.toLowerCase().includes(normalizedName)
  ) || null;

  if (containsMatch) {
    console.log('[DB Search] Contains match found:', containsMatch.castingName);
    return containsMatch;
  }

  // 3. Kelime bazlı arama - önemli kelimeleri çıkar
  const words = normalizedName
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !['the', 'and', 'or', 'of', 'a', 'an'].includes(word));

  if (words.length === 0) {
    return containsMatch;
  }

  // 4. Tüm modelleri al ve similarity hesapla (daha geniş arama)
  // SQLite için manuel filtreleme - zaten allModels'i yukarıda aldık
  const filteredModels = allModels.filter(model => {
    const modelNameLower = model.castingName.toLowerCase();
    const castingIdLower = (model.castingId || '').toLowerCase();
    
    // Her kelime için kontrol et
    return words.some(word => 
      modelNameLower.includes(word) || castingIdLower.includes(word)
    );
  }).slice(0, 50); // İlk 50 sonucu al

  if (filteredModels.length === 0) {
    return containsMatch;
  }

  // 5. Gelişmiş similarity scoring
  const scoredModels = filteredModels.map(model => {
    const similarity = calculateAdvancedSimilarity(normalizedName, model.castingName.toLowerCase());
    return {
      ...model,
      similarity,
    };
  });

  // En yüksek similarity'ye göre sırala
  scoredModels.sort((a, b) => b.similarity - a.similarity);
  
  console.log('[DB Search] Top 3 matches:', scoredModels.slice(0, 3).map(m => ({
    name: m.castingName,
    similarity: m.similarity.toFixed(2),
  })));
  
  // En yüksek skorlu modeli döndür (minimum 0.6 similarity - daha yüksek threshold, yanlış eşleşmeleri azaltır)
  if (scoredModels[0].similarity >= 0.6) {
    return {
      id: scoredModels[0].id,
      castingName: scoredModels[0].castingName,
      castingId: scoredModels[0].castingId,
    };
  }

  // Eğer hiçbir eşleşme yeterince yüksek değilse, en iyi sonucu döndür
  return scoredModels[0] || containsMatch;
}

/**
 * Gelişmiş similarity hesaplama - Levenshtein distance + weighted scoring
 */
function calculateAdvancedSimilarity(str1: string, str2: string): number {
  // 1. Exact match
  if (str1 === str2) return 1.0;
  
  // 2. Substring match (bir string diğerini içeriyor)
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = Math.max(str1.length, str2.length);
    const shorter = Math.min(str1.length, str2.length);
    return 0.85 + (shorter / longer) * 0.1; // 0.85-0.95 arası
  }
  
  // 3. Levenshtein distance hesapla
  const levenshteinDistance = calculateLevenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  const levenshteinScore = 1 - (levenshteinDistance / maxLength);
  
  // 4. Kelime bazlı eşleşme
  const words1 = str1.split(/\s+/).filter(w => w.length > 1);
  const words2 = str2.split(/\s+/).filter(w => w.length > 1);
  
  let wordMatchScore = 0;
  if (words1.length > 0 && words2.length > 0) {
    const matches = words1.filter(w1 => words2.some(w2 => {
      // Tam kelime eşleşmesi
      if (w1 === w2) return true;
      // Substring eşleşmesi
      if (w1.includes(w2) || w2.includes(w1)) return true;
      // Levenshtein distance < 2 (yakın kelimeler)
      return calculateLevenshteinDistance(w1, w2) <= 2;
    })).length;
    
    wordMatchScore = matches / Math.max(words1.length, words2.length);
  }
  
  // 5. Synonym handling (yaygın eş anlamlılar)
  const synonyms: { [key: string]: string[] } = {
    'mustang': ['ford mustang'],
    'camaro': ['chevrolet camaro'],
    'corvette': ['chevrolet corvette'],
    '67': ['1967', "'67"],
    '68': ['1968', "'68"],
  };
  
  let synonymScore = 0;
  for (const [key, values] of Object.entries(synonyms)) {
    const hasKey = str1.includes(key) || str2.includes(key);
    const hasValue = values.some(v => str1.includes(v) || str2.includes(v));
    if (hasKey && hasValue) {
      synonymScore = 0.1;
      break;
    }
  }
  
  // 6. Weighted combination
  const finalScore = (
    levenshteinScore * 0.4 +      // Levenshtein ağırlığı
    wordMatchScore * 0.5 +         // Kelime eşleşmesi ağırlığı
    synonymScore * 0.1             // Synonym bonus
  );
  
  return Math.min(1.0, finalScore);
}

/**
 * Levenshtein distance hesaplama (string similarity için)
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Base cases
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  // Matrix oluştur
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Dynamic programming ile hesapla
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Görselden model tanıma (Sadece Gemini kullan)
 */
export async function recognizeModelFromImage(
  imageUrl: string | Buffer
): Promise<RecognitionResult | null> {
  try {
    // Buffer'a çevir
    let imageBuffer: Buffer;
    if (typeof imageUrl === 'string') {
      const response = await fetch(imageUrl);
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      imageBuffer = imageUrl;
    }

    // Sadece Gemini kullan
    console.log('[Image Recognition] Starting Gemini recognition...');
    
    const geminiResult = await recognizeModelFromImageWithGemini(imageBuffer);

    if (!geminiResult) {
      console.log('[Image Recognition] Gemini recognition failed');
      return null;
    }

    console.log('[Image Recognition] Gemini result:', geminiResult.modelName, 'confidence:', geminiResult.confidence);
    return geminiResult;
  } catch (error) {
    console.error('[Image Recognition] Error:', error);
    return null;
  }
}

/**
 * Google Vision API ile görselden model tanıma (fallback)
 */
async function recognizeModelFromImageWithGoogleVision(
  imageBuffer: Buffer
): Promise<RecognitionResult | null> {
  const apiKey = await getGoogleVisionApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    // Base64 encode
    const imageContent = imageBuffer.toString('base64');

    // Label detection
    console.log('[Google Vision] Making API request...');
    const labelResponse = await fetch(
      `${GOOGLE_VISION_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageContent,
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 10 },
              ],
            },
          ],
        }),
      }
    );

    console.log('[Google Vision] Response status:', labelResponse.status, labelResponse.statusText);

    if (!labelResponse.ok) {
      const errorText = await labelResponse.text();
      console.error('[Google Vision] API Error Response:', errorText);
      
      let errorMessage = 'Google Vision API error';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
          // API disabled hatası için özel mesaj
          if (errorJson.error.code === 403 && errorJson.error.status === 'PERMISSION_DENIED') {
            errorMessage = 'Google Cloud Vision API etkin değil. Lütfen Google Cloud Console\'dan API\'yi etkinleştirin.';
          }
        }
      } catch (e) {
        // JSON parse hatası, orijinal mesajı kullan
      }
      
      throw new Error(`Google Vision API error: ${labelResponse.status} ${labelResponse.statusText} - ${errorMessage}`);
    }

    const labelData = await labelResponse.json();
    const responses = labelData.responses?.[0];
    
    console.log('[Google Vision] API Response received');
    
    if (!responses) {
      console.log('[Google Vision] No responses in API result');
      return null;
    }

    const labels = responses.labelAnnotations || [];
    console.log('[Google Vision] Labels found:', labels.length);
    console.log('[Google Vision] Top labels:', labels.slice(0, 5).map((l: any) => l.description));
    
    // Hot Wheels ile ilgili etiketleri bul
    const hotWheelsLabels = labels.filter(
      (label: any) =>
        label.description?.toLowerCase().includes('hot wheels') ||
        label.description?.toLowerCase().includes('toy car') ||
        label.description?.toLowerCase().includes('diecast') ||
        label.description?.toLowerCase().includes('toy') ||
        label.description?.toLowerCase().includes('car') ||
        label.description?.toLowerCase().includes('vehicle')
    );

    console.log('[Google Vision] Hot Wheels related labels:', hotWheelsLabels.length);
    if (hotWheelsLabels.length > 0) {
      console.log('[Google Vision] Hot Wheels labels:', hotWheelsLabels.map((l: any) => l.description));
    }

    // Eğer Hot Wheels label'ı yoksa bile devam et (text detection ile deneyelim)
    // if (hotWheelsLabels.length === 0) {
    //   console.log('[Google Vision] No Hot Wheels labels found, but continuing with text detection');
    //   return null;
    // }

    // Text detection
    const textAnnotations = responses.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';
    console.log('[Google Vision] Detected text:', fullText.substring(0, 200));
    
    // Veritabanında benzer model adlarını ara
    let words: string[] = [];
    
    // Önce text'ten kelimeleri çıkar
    if (fullText && fullText.length > 0) {
      words = fullText
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 5); // İlk 5 kelimeyi al
    }
    
    // Eğer text yoksa, label'lardan kelimeler çıkar
    if (words.length === 0 && labels.length > 0) {
      console.log('[Google Vision] No text found, using labels for search');
      words = labels
        .map((label: any) => label.description?.toLowerCase())
        .filter((desc: string | undefined): desc is string => !!desc && desc.length > 3)
        .slice(0, 5);
    }
    
    console.log('[Google Vision] Searching for models with words:', words);
    
    if (words.length === 0) {
      console.log('[Google Vision] No searchable words found in text or labels');
      // En azından "car" veya "toy" gibi genel terimlerle arama yapalım
      words = ['car', 'toy', 'vehicle'];
    }
    
    const models = await prisma.model.findMany({
      where: {
        OR: words.map((word) => ({
          castingName: {
            contains: word,
          },
        })),
      },
      take: 10, // Daha fazla sonuç al
      select: {
        id: true,
        castingName: true,
        castingId: true,
      },
    });

    console.log('[Google Vision] Found models:', models.length);
    if (models.length > 0) {
      console.log('[Google Vision] Matched models:', models.map(m => m.castingName));
      // En uzun eşleşmeyi seç (daha spesifik olabilir)
      const bestMatch = models.reduce((best, current) => 
        current.castingName.length > best.castingName.length ? current : best
      );
      
      return {
        modelName: bestMatch.castingName,
        confidence: 0.6, // Text olmadığı için confidence düşük
        details: {
          castingName: bestMatch.castingName,
          castingId: bestMatch.castingId || undefined,
        },
      };
    }

    // Eğer veritabanında bulunamazsa, text'ten model adını çıkarmaya çalış
    if (fullText && fullText.length > 0) {
      const modelNameMatch = fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (modelNameMatch) {
        console.log('[Google Vision] Extracted model name from text:', modelNameMatch[1]);
        return {
          modelName: modelNameMatch[1],
          confidence: 0.5,
        };
      }
    }

    console.log('[Google Vision] Could not recognize model from image');
    return null;
  } catch (error) {
    console.error('Error recognizing model from image:', error);
    return null;
  }
}

/**
 * Görsel analizi (hasar tespiti, durum kontrolü)
 */
export async function analyzeImageCondition(
  imageUrl: string | Buffer
): Promise<{
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  hasDamage: boolean;
  notes: string[];
} | null> {
  const apiKey = await getGoogleVisionApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    // Base64 encode
    let imageContent: string;
    if (typeof imageUrl === 'string') {
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      imageContent = buffer.toString('base64');
    } else {
      imageContent = imageUrl.toString('base64');
    }

    const response = await fetch(
      `${GOOGLE_VISION_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageContent,
              },
              features: [{ type: 'LABEL_DETECTION', maxResults: 20 }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Google Vision API error');
    }

    const data = await response.json();
    const labels = data.responses?.[0]?.labelAnnotations || [];
    
    const damageKeywords = ['scratch', 'damage', 'dent', 'crack', 'broken', 'worn'];
    const hasDamage = labels.some((label: any) =>
      damageKeywords.some((keyword) =>
        label.description?.toLowerCase().includes(keyword)
      )
    );

    // Basit bir condition hesaplama
    let condition: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    const notes: string[] = [];

    if (hasDamage) {
      condition = 'fair';
      notes.push('Görselde hasar belirtileri tespit edildi');
    }

    // Parlaklık ve netlik kontrolü (basit)
    const qualityLabels = labels.filter(
      (label: any) =>
        label.description?.toLowerCase().includes('shiny') ||
        label.description?.toLowerCase().includes('new')
    );

    if (qualityLabels.length > 0) {
      condition = 'excellent';
      notes.push('Model yeni görünüyor');
    }

    return {
      condition,
      hasDamage,
      notes,
    };
  } catch (error) {
    console.error('Error analyzing image condition:', error);
    return null;
  }
}

