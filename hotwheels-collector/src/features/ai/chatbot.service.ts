import OpenAI from 'openai';
import prisma from '@/db';

let openaiClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

export async function getOpenAIClient(): Promise<OpenAI | null> {
  // First try to get from database
  let apiKey: string | null = null;
  
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'openai_api_key' },
    });
    apiKey = setting?.value || null;
  } catch (error) {
    console.error('Error fetching OpenAI API key from database:', error);
  }

  // Fallback to environment variable if not in database
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY || null;
  }

  if (!apiKey) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  // If API key changed or client doesn't exist, create new client
  if (!openaiClient || cachedApiKey !== apiKey) {
    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
    cachedApiKey = apiKey;
  }

  return openaiClient;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  suggestions?: string[];
  relatedModels?: Array<{
    id: number;
    name: string;
  }>;
}

/**
 * Koleksiyon hakkında sorular için chatbot
 */
export async function chatWithBot(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse | null> {
  const client = await getOpenAIClient();
  if (!client) {
    return {
      message: 'AI chatbot şu anda kullanılamıyor. Lütfen Ayarlar > API Entegrasyonları bölümünden OpenAI API key\'inizi yapılandırın.',
    };
  }

  try {
    // Koleksiyon istatistiklerini al
    const [totalModels, totalVariants, ownedVariants, totalValue] = await Promise.all([
      prisma.model.count(),
      prisma.variant.count(),
      prisma.variant.count({ where: { owned: true } }),
      prisma.model.aggregate({
        where: { owned: true },
        _sum: {
          packedPrice: true,
          loosePrice: true,
        },
      }),
    ]);

    const collectionValue =
      (totalValue._sum.packedPrice || 0) + (totalValue._sum.loosePrice || 0);

    // Sistem mesajı
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `Sen Hot Wheels koleksiyon yönetim sisteminin AI asistanısın. Kullanıcıya koleksiyonu hakkında yardımcı oluyorsun.

Koleksiyon Bilgileri:
- Toplam Model: ${totalModels}
- Toplam Varyant: ${totalVariants}
- Sahip Olunan Varyant: ${ownedVariants}
- Koleksiyon Değeri: ${collectionValue.toFixed(2)} TL

Kullanıcıya şu konularda yardımcı olabilirsin:
- Koleksiyon önerileri
- Model bilgileri
- Fiyat tahminleri
- Koleksiyon tamamlanma önerileri
- Genel Hot Wheels bilgileri

Türkçe yanıt ver. Kısa ve öz ol.`,
    };

    // Mesaj geçmişi
    const messages: ChatMessage[] = [systemMessage, ...conversationHistory.slice(-10)]; // Son 10 mesaj
    messages.push({
      role: 'user',
      content: message,
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo', // GPT-4 yerine GPT-3.5-turbo kullan (daha uyumlu)
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'Üzgünüm, bir hata oluştu.';

    // İlgili modelleri bul (mesajda model adı geçiyorsa)
    const relatedModels = await findRelatedModels(message);

    return {
      message: response,
      relatedModels: relatedModels.length > 0 ? relatedModels : undefined,
    };
  } catch (error: any) {
    console.error('Error in chatbot:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    
    // Daha detaylı hata mesajı
    let errorMessage = 'Üzgünüm, bir hata oluştu.';
    if (error?.message?.includes('API key')) {
      errorMessage = 'API key geçersiz veya hatalı. Lütfen Ayarlar > API Entegrasyonları bölümünden API key\'inizi kontrol edin.';
    } else if (error?.status === 401 || error?.code === 'invalid_api_key') {
      errorMessage = 'API key geçersiz. Lütfen OpenAI API key\'inizi kontrol edin.';
    } else if (error?.status === 429) {
      errorMessage = 'API limiti aşıldı. Lütfen daha sonra tekrar deneyin.';
    } else if (error?.message) {
      errorMessage = `Hata: ${error.message}`;
    }
    
    return {
      message: errorMessage,
    };
  }
}

/**
 * Mesajda geçen model adlarını bul
 */
async function findRelatedModels(message: string): Promise<Array<{ id: number; name: string }>> {
  // Basit keyword extraction
  const words = message
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);

  if (words.length === 0) {
    return [];
  }

  // SQLite'ta mode: 'insensitive' desteklenmediği için basit contains kullanıyoruz
  // (Case-sensitive arama yapacak, ama çalışacak)
  const models = await prisma.model.findMany({
    where: {
      OR: words.map((word) => ({
        castingName: { contains: word },
      })),
    },
    take: 5,
    select: {
      id: true,
      castingName: true,
    },
  });

  return models.map((m) => ({
    id: m.id,
    name: m.castingName,
  }));
}

/**
 * Öneri sistemi için AI
 */
export async function getAIRecommendations(userId?: string): Promise<{
  missingModels: Array<{ id: number; name: string; reason: string }>;
  valuableModels: Array<{ id: number; name: string; estimatedValue: number }>;
  completionSuggestions: Array<{ collectionId: number; collectionName: string; completionPercent: number }>;
}> {
  // Sahip olunmayan modeller
  const missingModels = await prisma.model.findMany({
    where: { owned: false },
    take: 10,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      castingName: true,
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
    },
  });

  // Değerli modeller
  const valuableModels = await prisma.model.findMany({
    where: {
      owned: false,
      OR: [
        { packedPrice: { gt: 100 } },
        { loosePrice: { gt: 100 } },
      ],
    },
    take: 10,
    orderBy: [
      { packedPrice: 'desc' },
      { loosePrice: 'desc' },
    ],
    select: {
      id: true,
      castingName: true,
      packedPrice: true,
      loosePrice: true,
    },
  });

  // Tamamlanma önerileri
  const collections = await prisma.collection.findMany({
    include: {
      models: true,
      year: true,
    },
  });

  const completionSuggestions = collections
    .map((collection) => {
      const total = collection.models.length;
      const owned = collection.models.filter((m) => m.owned).length;
      const completionPercent = total > 0 ? (owned / total) * 100 : 0;

      return {
        collectionId: collection.id,
        collectionName: `${collection.name} (${collection.year.year})`,
        completionPercent,
      };
    })
    .filter((c) => c.completionPercent > 0 && c.completionPercent < 100)
    .sort((a, b) => b.completionPercent - a.completionPercent)
    .slice(0, 5);

  return {
    missingModels: missingModels.map((m) => ({
      id: m.id,
      name: m.castingName,
      reason: `${m.subSeries?.collection.name || 'Unknown'} koleksiyonunda eksik`,
    })),
    valuableModels: valuableModels.map((m) => ({
      id: m.id,
      name: m.castingName,
      estimatedValue: Math.max(m.packedPrice || 0, m.loosePrice || 0),
    })),
    completionSuggestions,
  };
}




