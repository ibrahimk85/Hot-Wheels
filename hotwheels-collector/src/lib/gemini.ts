import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting } from '@/features/settings/settings.service';
import { isMainlineOrdinalColorVariant } from '@/lib/mainline-color-variant';

export interface ModelData {
  castingName: string;
  year?: number;
  collectionName?: string;
  toyNumber?: string;
  variants?: Array<{
    cardNumber?: string;
    toyNumber?: string;
    color?: string;
    year?: number;
  }>;
}

/**
 * Generate an optimized Google Images search query using Gemini API
 * @param modelData - Model information (casting name, year, collection, etc.)
 * @returns Optimized search query string
 */
export async function generateOptimizedSearchQuery(
  modelData: ModelData
): Promise<string> {
  console.log('[GEMINI] Generating search query for:', modelData);
  const apiKey = await getSetting('gemini_api_key');

  if (!apiKey) {
    console.error('[GEMINI] API key not configured');
    throw new Error(
      'Gemini API key not configured. Please set it in Settings.'
    );
  }

  console.log('[GEMINI] API key found, initializing...');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-2.5-flash as primary (confirmed working from test endpoint)
  // Fallback to other working models if needed
  let modelName = 'gemini-2.5-flash'; // Primary choice - confirmed working
  const fallbackModels = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-preview-09-2025',
    'gemini-3-flash-preview',
  ];
  
  const model = genAI.getGenerativeModel({ model: modelName });

  // Build model information string
  const modelInfo: string[] = [];
  modelInfo.push(`Casting Name: ${modelData.castingName}`);
  
  if (modelData.year) {
    modelInfo.push(`Year: ${modelData.year}`);
  }
  
  if (modelData.collectionName) {
    modelInfo.push(`Collection: ${modelData.collectionName}`);
  }
  
  if (modelData.toyNumber) {
    modelInfo.push(`Toy#: ${modelData.toyNumber}`);
  }
  
  let variantForSearch: typeof modelData.variants[0] | null = null;
  if (modelData.collectionName === 'Mainline' && modelData.variants && modelData.variants.length > 0) {
    variantForSearch =
      modelData.variants.find(v => v.color && isMainlineOrdinalColorVariant(v.color)) ?? null;
  }

  const variantToUse = variantForSearch || (modelData.variants && modelData.variants.length > 0 ? modelData.variants[0] : null);
  
  if (variantToUse) {
    if (variantToUse.cardNumber) {
      modelInfo.push(`COL#: ${variantToUse.cardNumber}`);
    }
    if (variantToUse.toyNumber && variantToUse.toyNumber !== modelData.toyNumber) {
      modelInfo.push(`Variant Toy#: ${variantToUse.toyNumber}`);
    }
    if (variantToUse.color) {
      modelInfo.push(`Color: ${variantToUse.color}`);
    }
  }

  const prompt = `Create an optimized Google Images search query for a Hot Wheels die-cast car model.

Model Information:
${modelInfo.join('\n')}

Requirements:
- Include the casting name (model name)
- Include the year if available
- Include "Hot Wheels" brand name
- Include collection type (e.g., "Mainline", "Car Culture", "Premium") if available
- Include Toy# if available
- Include COL# if available
- Keep the query concise and focused
- Use terms that will find high-quality product images

Return ONLY the search query string, nothing else. Do not include any explanation or additional text.`;

  try {
    console.log('[GEMINI] Calling model:', modelName);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const query = response.text().trim();
    console.log('[GEMINI] Generated query:', query);

    // Clean up the response - remove quotes if present
    const cleanedQuery = query.replace(/^["']|["']$/g, '');
    console.log('[GEMINI] Cleaned query:', cleanedQuery);
    return cleanedQuery;
  } catch (error: any) {
    console.error('Error generating search query with Gemini:', error);
    
    // If model not found or quota error, try fallback models
    if (error?.message?.includes('not found') || error?.message?.includes('404') || error?.message?.includes('429')) {
      console.log('[Gemini] Primary model failed, trying fallback models...');
      
      for (const fallbackModelName of fallbackModels) {
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
          const result = await fallbackModel.generateContent(prompt);
          const response = await result.response;
          const query = response.text().trim();
          console.log('[Gemini] Successfully used fallback model:', fallbackModelName);
          return query.replace(/^["']|["']$/g, '');
        } catch (fallbackError) {
          console.warn(`[Gemini] Fallback model ${fallbackModelName} also failed:`, fallbackError);
          continue;
        }
      }
    }
    
    throw new Error(
      `Failed to generate search query: ${error?.message || 'Unknown error'}`
    );
  }
}

