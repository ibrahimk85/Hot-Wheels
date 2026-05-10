import { NextRequest, NextResponse } from 'next/server';
import { recognizeModelFromImage, RecognitionResult } from '@/features/ai/image-recognition.service';

export async function POST(request: NextRequest) {
  console.log('[API] /api/ai/recognize - POST request received');
  
  try {
    const formData = await request.formData();
    
    // Çoklu resim desteği - 'images' veya 'image' alanlarını kontrol et
    const imageFiles = formData.getAll('images') as File[];
    const singleImage = formData.get('image') as File;
    
    const allImages: File[] = imageFiles.length > 0 
      ? imageFiles 
      : singleImage 
        ? [singleImage] 
        : [];

    if (allImages.length === 0) {
      console.log('[API] /api/ai/recognize - No image files provided');
      return NextResponse.json(
        { error: 'En az bir resim dosyası gerekli' },
        { status: 400 }
      );
    }

    console.log(`[API] /api/ai/recognize - ${allImages.length} image file(s) received`);

    // Tüm resimleri buffer'a çevir ve analiz et
    const imageBuffers: Buffer[] = [];
    
    for (const imageFile of allImages) {
      // HEIC kontrolü - frontend'de dönüştürülmüş olmalı
      const isHeic = imageFile.type === 'image/heic' || 
                     imageFile.type === 'image/heif' ||
                     imageFile.name.toLowerCase().endsWith('.heic') ||
                     imageFile.name.toLowerCase().endsWith('.heif');

      if (isHeic) {
        console.log('[API] /api/ai/recognize - HEIC file detected, skipping (should be converted in frontend)');
        continue;
      }

      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffers.push(Buffer.from(arrayBuffer));
    }

    if (imageBuffers.length === 0) {
      return NextResponse.json(
        { 
          error: 'Geçerli resim dosyası bulunamadı',
          details: 'Tüm dosyalar HEIC formatında olabilir. Lütfen frontend\'de dönüştürüldüğünden emin olun.'
        },
        { status: 400 }
      );
    }

    console.log(`[API] /api/ai/recognize - Processing ${imageBuffers.length} image(s)...`);

    // Çoklu resim analizi - tüm resimleri analiz et ve sonuçları birleştir
    const results = await Promise.allSettled(
      imageBuffers.map(buffer => recognizeModelFromImage(buffer))
    );

    // Başarılı sonuçları topla
    const successfulResults: RecognitionResult[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value !== null) {
        successfulResults.push(r.value);
      }
    });

    if (successfulResults.length === 0) {
      console.log('[API] /api/ai/recognize - All recognition attempts failed');
      return NextResponse.json(
        { 
          error: 'Model tanınamadı',
          details: 'Tüm resimler analiz edildi ancak model tanınamadı. Bu durum şu sebeplerden kaynaklanabilir: 1) Gemini API key eksik veya geçersiz, 2) Görsellerde yeterli detay yok, 3) Model veritabanında bulunamadı.'
        },
        { status: 404 }
      );
    }

    console.log(`[API] /api/ai/recognize - ${successfulResults.length}/${imageBuffers.length} images recognized successfully`);

    // Çoklu resim analizi - Weighted voting ve consensus building
    // 1. Model adlarını normalize et ve grupla
    const modelNameMap = new Map<string, Array<{ result: RecognitionResult; weight: number }>>();
    
    successfulResults.forEach((result, index) => {
      // Her sonuca ağırlık ver (confidence'e göre)
      const weight = result.confidence;
      
      // Model adını normalize et (küçük harf, trim)
      const normalizedName = result.modelName.toLowerCase().trim();
      
      // Benzer model adlarını grupla (fuzzy grouping)
      let foundGroup = false;
      for (const [groupName] of modelNameMap.entries()) {
        // Eğer model adları çok benzer ise (Levenshtein distance < 3), aynı gruba ekle
        if (calculateStringSimilarity(normalizedName, groupName) > 0.8) {
          modelNameMap.get(groupName)!.push({ result, weight });
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        modelNameMap.set(normalizedName, [{ result, weight }]);
      }
    });

    // 2. Her grup için weighted score hesapla
    const scoredGroups = Array.from(modelNameMap.entries()).map(([groupName, items]) => {
      // Weighted average confidence
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      const avgConfidence = items.reduce((sum, item) => sum + item.result.confidence * item.weight, 0) / totalWeight;
      
      // Consensus score (kaç resim aynı sonucu verdi)
      const consensusScore = items.length / successfulResults.length;
      
      // Final score = weighted confidence + consensus bonus
      const finalScore = avgConfidence * 0.7 + consensusScore * 0.3;
      
      return {
        modelName: groupName,
        items,
        avgConfidence,
        consensusScore,
        finalScore,
        count: items.length,
      };
    });

    // 3. En yüksek skorlu grubu seç
    scoredGroups.sort((a, b) => b.finalScore - a.finalScore);
    const bestGroup = scoredGroups[0];

    console.log('[API] Top 3 model groups:', scoredGroups.slice(0, 3).map(g => ({
      name: g.modelName,
      score: g.finalScore.toFixed(2),
      consensus: g.consensusScore.toFixed(2),
      count: g.count,
    })));

    // 4. En iyi sonucu seç (en yüksek confidence'e sahip)
    const bestResult = bestGroup.items.reduce((best, current) => 
      current.result.confidence > best.result.confidence ? current : best
    ).result;

    // 5. Detayları birleştir - consensus building
    const mergedDetails: RecognitionResult['details'] = {
      ...bestResult.details,
    };

    // Her alan için voting yap - en çok geçen değeri kullan
    const fieldVotes: { [key: string]: Map<string, number> } = {
      year: new Map(),
      series: new Map(),
      subSeries: new Map(),
      color: new Map(),
      wheelType: new Map(),
      castingId: new Map(),
    };

    successfulResults.forEach(result => {
      if (result.details) {
        if (result.details.year) {
          const key = result.details.year.toString();
          fieldVotes.year.set(key, (fieldVotes.year.get(key) || 0) + result.confidence);
        }
        if (result.details.series) {
          const key = result.details.series.toLowerCase();
          fieldVotes.series.set(key, (fieldVotes.series.get(key) || 0) + result.confidence);
        }
        if (result.details.subSeries) {
          const key = result.details.subSeries.toLowerCase();
          fieldVotes.subSeries.set(key, (fieldVotes.subSeries.get(key) || 0) + result.confidence);
        }
        if (result.details.color) {
          const key = result.details.color.toLowerCase();
          fieldVotes.color.set(key, (fieldVotes.color.get(key) || 0) + result.confidence);
        }
        if (result.details.wheelType) {
          const key = result.details.wheelType.toLowerCase();
          fieldVotes.wheelType.set(key, (fieldVotes.wheelType.get(key) || 0) + result.confidence);
        }
        if (result.details.castingId) {
          const key = result.details.castingId.toLowerCase();
          fieldVotes.castingId.set(key, (fieldVotes.castingId.get(key) || 0) + result.confidence);
        }
      }
    });

    // En çok oy alan değerleri kullan
    for (const [field, votes] of Object.entries(fieldVotes)) {
      if (votes.size > 0) {
        const topVote = Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0];
        if (topVote[1] > 0.3) { // Minimum threshold
          if (field === 'year') {
            mergedDetails.year = parseInt(topVote[0]);
          } else if (field === 'series') {
            mergedDetails.series = topVote[0];
          } else if (field === 'subSeries') {
            mergedDetails.subSeries = topVote[0];
          } else if (field === 'color') {
            mergedDetails.color = topVote[0];
          } else if (field === 'wheelType') {
            mergedDetails.wheelType = topVote[0];
          } else if (field === 'castingId') {
            mergedDetails.castingId = topVote[0];
          }
        }
      }
    }

    // 6. Confidence'i artır - çoklu resim analizi daha güvenilir
    // Consensus score'a göre confidence artır
    const consensusBonus = Math.min(0.15, bestGroup.consensusScore * 0.2);
    const finalConfidence = Math.min(0.95, bestResult.confidence + consensusBonus);

    // Helper function for string similarity
    function calculateStringSimilarity(str1: string, str2: string): number {
      const longer = Math.max(str1.length, str2.length);
      if (longer === 0) return 1.0;
      const distance = calculateLevenshteinDistance(str1, str2);
      return 1 - (distance / longer);
    }

    function calculateLevenshteinDistance(str1: string, str2: string): number {
      const len1 = str1.length;
      const len2 = str2.length;
      if (len1 === 0) return len2;
      if (len2 === 0) return len1;
      
      const matrix: number[][] = [];
      for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      
      return matrix[len1][len2];
    }

    const finalResult = {
      modelName: bestResult.modelName,
      confidence: finalConfidence,
      details: mergedDetails,
      imagesAnalyzed: successfulResults.length,
      totalImages: imageBuffers.length,
      consensusScore: bestGroup.consensusScore,
      modelGroupsFound: scoredGroups.length,
    };

    console.log('[API] /api/ai/recognize] ===== Final Result =====');
    console.log('[API] Model Name:', finalResult.modelName);
    console.log('[API] Confidence:', finalConfidence.toFixed(2));
    console.log('[API] Consensus Score:', bestGroup.consensusScore.toFixed(2));
    console.log('[API] Images Analyzed:', `${finalResult.imagesAnalyzed}/${finalResult.totalImages}`);
    console.log('[API] Model Groups Found:', finalResult.modelGroupsFound);
    console.log('[API] Details:', JSON.stringify(mergedDetails, null, 2));

    return NextResponse.json(finalResult);
  } catch (error: any) {
    console.error('[API] /api/ai/recognize - Error:', error);
    console.error('[API] /api/ai/recognize - Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: 'Failed to recognize model',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

