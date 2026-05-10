import prisma from '@/db';
import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export interface CategorizationResult {
  tags: string[];
  category: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  estimatedValue?: number;
}

/**
 * Model için otomatik kategorizasyon ve etiketleme
 */
export async function autoCategorizeModel(modelId: number): Promise<CategorizationResult | null> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    include: {
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
      variants: {
        take: 5,
      },
    },
  });

  if (!model) {
    return null;
  }

  const client = getOpenAIClient();
  if (!client) {
    // OpenAI olmadan basit kategorizasyon
    return simpleCategorize(model);
  }

  try {
    const prompt = `Hot Wheels model bilgilerini analiz et ve kategorize et:

Model Adı: ${model.castingName}
Casting ID: ${model.castingId || 'Yok'}
Koleksiyon: ${model.subSeries?.collection.name || 'Bilinmiyor'}
Yıl: ${model.subSeries?.collection.year.year || 'Bilinmiyor'}
Alt Seri: ${model.subSeries?.name || 'Yok'}
Açıklama: ${model.description || 'Yok'}

Bu model için:
1. 3-5 etiket öner (örnek: "sports car", "classic", "treasure hunt", "supercar")
2. Kategori belirle (örnek: "Sports Car", "Classic", "Fantasy", "Movie/TV")
3. Nadirlik seviyesi tahmin et (common, rare, epic, legendary)
4. Tahmini değer (TL cinsinden, sadece sayı)

JSON formatında döndür:
{
  "tags": ["tag1", "tag2", "tag3"],
  "category": "category name",
  "rarity": "common|rare|epic|legendary",
  "estimatedValue": 50
}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'Sen bir Hot Wheels koleksiyon uzmanısın. Modelleri kategorize edip etiketleme yapıyorsun.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return simpleCategorize(model);
    }

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          tags: result.tags || [],
          category: result.category || 'Unknown',
          rarity: result.rarity || 'common',
          estimatedValue: result.estimatedValue || undefined,
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }

    return simpleCategorize(model);
  } catch (error) {
    console.error('Error in auto categorization:', error);
    return simpleCategorize(model);
  }
}

/**
 * Basit kategorizasyon (AI olmadan)
 */
function simpleCategorize(model: any): CategorizationResult {
  const tags: string[] = [];
  let category = 'Unknown';
  let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';

  // Koleksiyon adına göre kategori
  const collectionName = model.subSeries?.collection.name?.toLowerCase() || '';
  if (collectionName.includes('car culture')) {
    category = 'Car Culture';
    tags.push('premium', 'car culture');
  } else if (collectionName.includes('pop culture')) {
    category = 'Pop Culture';
    tags.push('pop culture', 'licensed');
  } else if (collectionName.includes('mainline')) {
    category = 'Mainline';
    tags.push('mainline', 'basic');
  } else if (collectionName.includes('boulevard')) {
    category = 'Boulevard';
    tags.push('boulevard', 'premium');
  }

  // TH/STH kontrolü
  const hasTH = model.variants?.some((v: any) => v.isTreasureHunt);
  const hasSTH = model.variants?.some((v: any) => v.isSuperTreasureHunt);

  if (hasSTH) {
    rarity = 'legendary';
    tags.push('super treasure hunt', 'sth');
  } else if (hasTH) {
    rarity = 'epic';
    tags.push('treasure hunt', 'th');
  }

  return {
    tags,
    category,
    rarity,
  };
}

/**
 * Toplu kategorizasyon
 */
export async function batchCategorizeModels(modelIds: number[]): Promise<Map<number, CategorizationResult>> {
  const results = new Map<number, CategorizationResult>();

  for (const modelId of modelIds) {
    const result = await autoCategorizeModel(modelId);
    if (result) {
      results.set(modelId, result);
    }
    // Rate limiting için kısa bekleme
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}




