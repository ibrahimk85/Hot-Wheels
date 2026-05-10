import prisma from '@/db';
import { Prisma } from '@prisma/client';
import { collectionUsesVariantLevelPreviewImages } from '@/lib/variant-preview-image';
import { mainlineOrdinalColorSortKey } from '@/lib/mainline-color-variant';

export interface VariantFilters {
  year?: number;
  onlyTH?: boolean;
  onlySTH?: boolean;
  packedOwnedStatus?: boolean;
  looseOwnedStatus?: boolean;
  wishlistedStatus?: boolean;
  collectionId?: number;
  collectionName?: string; // Koleksiyon ismi ile filtreleme (akıllı filtreleme için)
  subSeriesId?: number;
  category?: string; // Silver Series: 1st level (Anniversary)
  subSeriesName?: string; // Silver Series: 2nd level (Purple and Gold (2025), Blue and Gold (2026))
  search?: string;
  limit?: number;
  offset?: number;
  // Gelişmiş filtreler
  minPrice?: number;
  maxPrice?: number;
  priceType?: 'packed' | 'loose';
  hasImage?: boolean;
  hasNotes?: boolean;
}

function getNumericCardNumber(cardNumber: string | null | undefined): number {
  if (!cardNumber) return -1;
  const m = cardNumber.match(/\d+/);
  if (!m) return -1;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : -1;
}

/** Carded row may only be linked via Variant.imageId; merge into images[] for list UI. */
async function attachMissingPrimaryVariantImages<
  T extends {
    imageId: number | null;
    images: Array<{ id: number; path: string; alt: string | null }>;
  },
>(variants: T[]): Promise<void> {
  const missingIds = variants
    .filter((v) => v.imageId != null && !v.images?.some((i) => i.id === v.imageId))
    .map((v) => v.imageId!);
  if (missingIds.length === 0) return;
  const rows = await prisma.image.findMany({
    where: { id: { in: [...new Set(missingIds)] } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const v of variants) {
    if (v.imageId == null || v.images?.some((i) => i.id === v.imageId)) continue;
    const img = byId.get(v.imageId);
    if (img) {
      v.images = [...(v.images ?? []), img];
    }
  }
}

// Filtrelenmiş varyant listesi
export async function getVariants(filters: VariantFilters) {
  // Eğer arama terimi varsa, case-insensitive arama için model ID'lerini bul
  let modelIds: number[] | undefined = undefined;
  
  if (filters.search) {
    const searchTerm = filters.search.trim();
    // COL# araması için "COL#" veya "col#" prefix'ini temizle
    const cleanSearchTerm = searchTerm.replace(/^col#\s*/i, '').trim();
    
    // Model adına göre arama
    const modelsByName = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM Model 
      WHERE castingName COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    
    // COL# (cardNumber) araması - Variant tablosunda ara
    const variantsByColNumber = await prisma.$queryRaw<Array<{ modelId: number }>>`
      SELECT DISTINCT modelId FROM Variant 
      WHERE cardNumber COLLATE NOCASE LIKE '%' || ${cleanSearchTerm} || '%'
         OR cardNumber COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    
    // Her iki arama sonucunu birleştir
    const modelIdsByName = modelsByName.map(m => m.id);
    const modelIdsByColNumber = variantsByColNumber.map(v => v.modelId);
    
    // Tüm benzersiz model ID'lerini birleştir
    modelIds = [...new Set([...modelIdsByName, ...modelIdsByColNumber])];
    
    // Eğer hiç model bulunamadıysa, boş sonuç döndür
    if (modelIds.length === 0) {
      return [];
    }
  }

  // Koleksiyon ve alt seri filtresi için model filter oluştur
  const modelFilter: Prisma.ModelWhereInput = {};
  
  // Silver Series: subSeriesName + category ile filtreleme (subSeriesId'den önce)
  const isSilverSeries = filters.collectionName === 'Hot Wheels Silver Series';
  if (isSilverSeries && filters.subSeriesName) {
    const subSeriesWhere: Prisma.SubSeriesWhereInput = {
      collection: { name: 'Hot Wheels Silver Series' },
      OR: [
        { name: filters.subSeriesName },
        { name: { startsWith: filters.subSeriesName + ' - ' } },
      ],
    };
    if (filters.category) subSeriesWhere.category = filters.category;
    const subSeriesList = await prisma.subSeries.findMany({
      where: subSeriesWhere,
      select: { id: true },
    });
    const subSeriesIds = subSeriesList.map(ss => ss.id);
    if (subSeriesIds.length === 0) {
      return [];
    }
    if (modelIds) {
      const modelsWithSub = await prisma.model.findMany({
        where: { id: { in: modelIds }, subSeriesId: { in: subSeriesIds } },
        select: { id: true },
      });
      modelIds = modelsWithSub.map(m => m.id);
      if (modelIds.length === 0) return [];
      modelFilter.id = { in: modelIds };
    } else {
      modelFilter.subSeriesId = { in: subSeriesIds };
    }
  } else if (isSilverSeries && filters.category && !filters.subSeriesName) {
    const subSeriesByCategory = await prisma.subSeries.findMany({
      where: {
        category: filters.category,
        collection: { name: 'Hot Wheels Silver Series' },
      },
      select: { id: true },
    });
    const catSubSeriesIds = subSeriesByCategory.map(ss => ss.id);
    if (catSubSeriesIds.length > 0) {
      if (modelIds) {
        const modelsWithCat = await prisma.model.findMany({
          where: { id: { in: modelIds }, subSeriesId: { in: catSubSeriesIds } },
          select: { id: true },
        });
        modelIds = modelsWithCat.map(m => m.id);
        if (modelIds.length === 0) return [];
        modelFilter.id = { in: modelIds };
      } else {
        modelFilter.subSeriesId = { in: catSubSeriesIds };
      }
    }
  } else if (filters.subSeriesId) {
    if (modelIds) {
      // Search sonuçlarını subSeriesId'ye göre filtrele
      const modelsWithSubSeries = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          subSeriesId: filters.subSeriesId,
        },
        select: { id: true },
      });
      modelIds = modelsWithSubSeries.map(m => m.id);
      if (modelIds.length === 0) {
        return [];
      }
      modelFilter.id = { in: modelIds };
    } else {
      // Sadece subSeriesId varsa
      modelFilter.subSeriesId = filters.subSeriesId;
    }
  }
  
  // Koleksiyon filtresi - Akıllı filtreleme: collectionName + year kombinasyonu
  // Öncelik: collectionName > collectionId
  if (filters.collectionName) {
    // collectionName ile filtreleme - akıllı çapraz filtreleme
    const collectionWhere: Prisma.CollectionWhereInput = {
      name: filters.collectionName,
    };
    
    // Eğer year varsa, o yıla ait koleksiyonu filtrele
    if (filters.year) {
      collectionWhere.year = {
        year: filters.year,
      };
    }
    
    // Bu isimdeki koleksiyonları bul
    const matchingCollections = await prisma.collection.findMany({
      where: collectionWhere,
      select: { id: true },
    });
    
    if (matchingCollections.length === 0) {
      return [];
    }
    
    const collectionIds = matchingCollections.map(c => c.id);
    
    if (modelIds) {
      // Search sonuçlarını collectionName'e göre filtrele
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collectionId: { in: collectionIds },
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return [];
      }
      modelFilter.id = { in: modelIds };
    } else if (!filters.subSeriesId) {
      // Sadece collectionName varsa
      modelFilter.collectionId = { in: collectionIds };
    }
  } else if (filters.collectionId) {
    // Eski collectionId desteği (geriye dönük uyumluluk)
    if (modelIds) {
      // Search sonuçlarını collectionId'ye göre filtrele
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collectionId: filters.collectionId,
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return [];
      }
      modelFilter.id = { in: modelIds };
    } else if (!filters.subSeriesId) {
      // Sadece collectionId varsa ve subSeriesId yoksa, doğrudan collectionId kullan
      modelFilter.collectionId = filters.collectionId;
    }
  } else if (modelIds && !filters.subSeriesId) {
    // Sadece search varsa ve subSeriesId yoksa
    modelFilter.id = { in: modelIds };
  }

  // Gelişmiş filtreler için model filtreleri
  const advancedModelFilter: Prisma.ModelWhereInput = {};
  
  // Fiyat filtreleri
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceField = filters.priceType === 'loose' ? 'loosePrice' : 'packedPrice';
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      advancedModelFilter[priceField] = {
        gte: filters.minPrice,
        lte: filters.maxPrice,
      };
    } else if (filters.minPrice !== undefined) {
      advancedModelFilter[priceField] = { gte: filters.minPrice };
    } else if (filters.maxPrice !== undefined) {
      advancedModelFilter[priceField] = { lte: filters.maxPrice };
    }
  }

  // Görsel filtresi (model seviyesinde): yalnız belirli koleksiyonda; tüm koleksiyonlar + hasImage
  // için model.images boş kalan (Boulevard vb.) satırlar elenmesin — variant seviyesi yeterli.
  if (
    filters.hasImage === true &&
    !!filters.collectionName &&
    !collectionUsesVariantLevelPreviewImages(filters.collectionName)
  ) {
    advancedModelFilter.images = { some: {} };
  }

  // Not filtresi (model seviyesinde)
  if (filters.hasNotes === true) {
    advancedModelFilter.notes = { not: null };
  }

  // Model filtrelerini birleştir
  const finalModelFilter = {
    ...modelFilter,
    ...(Object.keys(advancedModelFilter).length > 0 ? advancedModelFilter : {}),
  };

  // Check if this is Team Transport collection
  let isTeamTransport = false;
  if (filters.collectionId) {
    const collection = await prisma.collection.findUnique({
      where: { id: filters.collectionId },
      select: { name: true }
    });
    isTeamTransport = collection?.name === 'Team Transport';
  }

  // For Team Transport: Filter out transport variants (only show car variants)
  // Transport variants have "Transport" in their releaseName
  const variantWhere: Prisma.VariantWhereInput = {
    year: filters.year ?? undefined,
    // TH and STH filter logic:
    // - If onlyTH is true and onlySTH is false: show only TH (isTreasureHunt: true, isSuperTreasureHunt: false)
    // - If onlyTH is false and onlySTH is true: show only STH (isTreasureHunt: false, isSuperTreasureHunt: true)
    // - If both are true: show both TH and STH (OR condition)
    // - If both are false: show all (no filter)
    ...(filters.onlyTH && !filters.onlySTH
      ? {
          isTreasureHunt: true,
          isSuperTreasureHunt: false,
        }
      : !filters.onlyTH && filters.onlySTH
      ? {
          isTreasureHunt: false,
          isSuperTreasureHunt: true,
        }
      : filters.onlyTH && filters.onlySTH
      ? {
          OR: [
            { isTreasureHunt: true, isSuperTreasureHunt: false },
            { isTreasureHunt: false, isSuperTreasureHunt: true },
          ],
        }
      : {}),
    packedOwned: filters.packedOwnedStatus ?? undefined,
    looseOwned: filters.looseOwnedStatus ?? undefined,
    wishlisted: filters.wishlistedStatus ?? undefined,
    model: Object.keys(finalModelFilter).length > 0 ? finalModelFilter : undefined,
    // Team Transport: hariç tut; hasImage: ilişkili görsel VEYA imageId (çakışan NOT anahtarı yok)
    ...(isTeamTransport || filters.hasImage === true
      ? {
          AND: [
            ...(isTeamTransport
              ? [
                  {
                    NOT: {
                      releaseName: {
                        contains: 'Transport',
                      },
                    },
                  },
                ]
              : []),
            ...(filters.hasImage === true
              ? [
                  {
                    NOT: {
                      AND: [{ images: { none: {} } }, { imageId: null }],
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
    // Not filtresi (variant seviyesinde)
    ...(filters.hasNotes === true
      ? {
          notes: {
            not: null,
          },
        }
      : {}),
  };

  // Silver Series: alt seri adına göre grupla, her alt seri içinde seri numarası (cardNumber) sırasına göre
  // Mainline: yıl (desc), sonra COL# (cardNumber asc), aynı COL için Toy# (toyNumber asc)
  // Boulevard: yıl ve alt seri fark etmeksizin cardNumber'a göre yeni -> eski (desc),
  // ancak 2012 ve 2013 kayıtları listenin en sonunda gösterilir.
  // Diğer koleksiyonlar (ör. Pop Culture, Car Culture, Fast & Furious Premium):
  // - Önce koleksiyon yılı (collection.year.year desc)
  // - Sonra alt seri adı (Mix / tema) desc (en yeni alt seri en önde)
  // - Sonra Col# / Series# (cardNumber) asc (1/5, 2/5, 3/5, 4/5, 5/5)
  const orderByClause: Prisma.VariantOrderByWithRelationInput[] | undefined =
    filters.collectionName === 'Hot Wheels Silver Series'
      ? [
          { model: { subSeries: { name: 'asc' } } },
          { cardNumber: 'asc' },
        ]
      : filters.collectionName === 'Mainline'
      ? [
          { year: 'desc' },
          { cardNumber: 'asc' },
          // SQLite sorts NULLs first asc → "1st color" rows (color = null)
          // come before "(2nd Color)", "(3rd Color)", … so wiki order is preserved.
          { color: 'asc' },
          { toyNumber: 'asc' },
        ]
      : filters.collectionName
      ? [
          {
            model: {
              subSeries: {
                collection: {
                  year: {
                    year: 'desc',
                  },
                },
              },
            },
          },
          { model: { subSeries: { name: 'desc' } } },
          { cardNumber: 'asc' },
        ]
      : filters.year
      ? [
          { year: 'desc' },
          { cardNumber: 'asc' },
        ]
      : undefined;

  const includeClause: Prisma.VariantInclude = {
    model: {
      include: {
        subSeries: {
          include: {
            collection: {
              include: {
                year: true, // Include year for VariantCard
              },
            },
          },
        },
        images: {
          orderBy: {
            order: 'asc',
          },
        }, // Include model images (for all collections, not just Team Transport)
      },
    },
    images: {
      orderBy: {
        order: 'asc',
      },
    },
  };

  const isBoulevard = filters.collectionName === 'Boulevard';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let variants;
  if (isBoulevard) {
    const nonLegacyVariants = await prisma.variant.findMany({
      where: {
        ...variantWhere,
        year: variantWhere.year === undefined ? { notIn: [2012, 2013] } : variantWhere.year,
      },
      include: includeClause,
    });

    const legacyVariants = await prisma.variant.findMany({
      where: {
        ...variantWhere,
        year:
          variantWhere.year === undefined
            ? { in: [2012, 2013] }
            : variantWhere.year === 2012 || variantWhere.year === 2013
            ? variantWhere.year
            : { in: [] },
      },
      include: includeClause,
    });

    const sortedNonLegacy = nonLegacyVariants.sort((a, b) => {
      const numDiff = getNumericCardNumber(b.cardNumber) - getNumericCardNumber(a.cardNumber);
      if (numDiff !== 0) return numDiff;
      return b.id - a.id;
    });
    const sortedLegacy = legacyVariants.sort((a, b) => {
      const numDiff = getNumericCardNumber(b.cardNumber) - getNumericCardNumber(a.cardNumber);
      if (numDiff !== 0) return numDiff;
      return b.id - a.id;
    });

    variants = [...sortedNonLegacy, ...sortedLegacy].slice(offset, offset + limit);
  } else {
    variants = await prisma.variant.findMany({
      where: variantWhere,
      include: includeClause,
      ...(orderByClause ? { orderBy: orderByClause } : {}),
      take: limit,
      skip: offset,
    });
  }

  await attachMissingPrimaryVariantImages(variants);

  // Mainline: within identical (year, cardNumber) buckets, force the
  // wiki-style "1st → 2nd → 3rd Color" order. Stable sort preserves the
  // outer Prisma-imposed order (year desc, cardNumber asc).
  if (filters.collectionName === 'Mainline') {
    type MainlineVariant = (typeof variants)[number];
    variants = (variants as MainlineVariant[])
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => {
        const ay = a.v.year ?? 0;
        const by = b.v.year ?? 0;
        if (ay !== by) return by - ay;

        const ac = a.v.cardNumber ?? '';
        const bc = b.v.cardNumber ?? '';
        if (ac !== bc) return ac < bc ? -1 : 1;

        const ak = mainlineOrdinalColorSortKey(a.v.color);
        const bk = mainlineOrdinalColorSortKey(b.v.color);
        if (ak !== bk) return ak - bk;

        const at = a.v.toyNumber ?? '';
        const bt = b.v.toyNumber ?? '';
        if (at !== bt) return at < bt ? -1 : 1;

        return a.idx - b.idx;
      })
      .map(({ v }) => v) as typeof variants;
  }

  return variants;
}

// Filtrelenmiş varyant sayısı
export async function getVariantsCount(filters: VariantFilters) {
  // Eğer arama terimi varsa, case-insensitive arama için model ID'lerini bul
  let modelIds: number[] | undefined = undefined;
  
  if (filters.search) {
    const searchTerm = filters.search.trim();
    // COL# araması için "COL#" veya "col#" prefix'ini temizle
    const cleanSearchTerm = searchTerm.replace(/^col#\s*/i, '').trim();
    
    // Model adına göre arama
    const modelsByName = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM Model 
      WHERE castingName COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    
    // COL# (cardNumber) araması - Variant tablosunda ara
    const variantsByColNumber = await prisma.$queryRaw<Array<{ modelId: number }>>`
      SELECT DISTINCT modelId FROM Variant 
      WHERE cardNumber COLLATE NOCASE LIKE '%' || ${cleanSearchTerm} || '%'
         OR cardNumber COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    
    // Her iki arama sonucunu birleştir
    const modelIdsByName = modelsByName.map(m => m.id);
    const modelIdsByColNumber = variantsByColNumber.map(v => v.modelId);
    
    // Tüm benzersiz model ID'lerini birleştir
    modelIds = [...new Set([...modelIdsByName, ...modelIdsByColNumber])];
    
    // Eğer hiç model bulunamadıysa, 0 döndür
    if (modelIds.length === 0) {
      return 0;
    }
  }

  // Koleksiyon ve alt seri filtresi için model filter oluştur
  const modelFilter: Prisma.ModelWhereInput = {};
  
  // Silver Series: subSeriesName + category (getVariantsCount)
  const isSilverSeriesCount = filters.collectionName === 'Hot Wheels Silver Series';
  if (isSilverSeriesCount && filters.subSeriesName) {
    const subSeriesWhereCount: Prisma.SubSeriesWhereInput = {
      collection: { name: 'Hot Wheels Silver Series' },
      OR: [
        { name: filters.subSeriesName },
        { name: { startsWith: filters.subSeriesName + ' - ' } },
      ],
    };
    if (filters.category) subSeriesWhereCount.category = filters.category;
    const subSeriesListCount = await prisma.subSeries.findMany({
      where: subSeriesWhereCount,
      select: { id: true },
    });
    const subSeriesIdsCount = subSeriesListCount.map(ss => ss.id);
    if (subSeriesIdsCount.length === 0) return 0;
    if (modelIds) {
      const modelsWithSubCount = await prisma.model.findMany({
        where: { id: { in: modelIds }, subSeriesId: { in: subSeriesIdsCount } },
        select: { id: true },
      });
      modelIds = modelsWithSubCount.map(m => m.id);
      if (modelIds.length === 0) return 0;
      modelFilter.id = { in: modelIds };
    } else {
      modelFilter.subSeriesId = { in: subSeriesIdsCount };
    }
  } else if (isSilverSeriesCount && filters.category && !filters.subSeriesName) {
    const subSeriesByCategoryCount = await prisma.subSeries.findMany({
      where: {
        category: filters.category,
        collection: { name: 'Hot Wheels Silver Series' },
      },
      select: { id: true },
    });
    const catSubSeriesIdsCount = subSeriesByCategoryCount.map(ss => ss.id);
    if (catSubSeriesIdsCount.length > 0) {
      if (modelIds) {
        const modelsWithCatCount = await prisma.model.findMany({
          where: { id: { in: modelIds }, subSeriesId: { in: catSubSeriesIdsCount } },
          select: { id: true },
        });
        modelIds = modelsWithCatCount.map(m => m.id);
        if (modelIds.length === 0) return 0;
        modelFilter.id = { in: modelIds };
      } else {
        modelFilter.subSeriesId = { in: catSubSeriesIdsCount };
      }
    }
  } else if (filters.subSeriesId) {
    if (modelIds) {
      // Search sonuçlarını subSeriesId'ye göre filtrele
      const modelsWithSubSeries = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          subSeriesId: filters.subSeriesId,
        },
        select: { id: true },
      });
      modelIds = modelsWithSubSeries.map(m => m.id);
      if (modelIds.length === 0) {
        return 0;
      }
      modelFilter.id = { in: modelIds };
    } else {
      // Sadece subSeriesId varsa
      modelFilter.subSeriesId = filters.subSeriesId;
    }
  }
  
  // Koleksiyon filtresi - Akıllı filtreleme: collectionName + year kombinasyonu
  // Öncelik: collectionName > collectionId
  if (filters.collectionName) {
    // collectionName ile filtreleme - akıllı çapraz filtreleme
    const collectionWhere: Prisma.CollectionWhereInput = {
      name: filters.collectionName,
    };
    
    // Eğer year varsa, o yıla ait koleksiyonu filtrele
    if (filters.year) {
      collectionWhere.year = {
        year: filters.year,
      };
    }
    
    // Bu isimdeki koleksiyonları bul
    const matchingCollections = await prisma.collection.findMany({
      where: collectionWhere,
      select: { id: true },
    });
    
    if (matchingCollections.length === 0) {
      return 0;
    }
    
    const collectionIds = matchingCollections.map(c => c.id);
    
    if (modelIds) {
      // Search sonuçlarını collectionName'e göre filtrele
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collectionId: { in: collectionIds },
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return 0;
      }
      modelFilter.id = { in: modelIds };
    } else if (!filters.subSeriesId) {
      // Sadece collectionName varsa
      modelFilter.collectionId = { in: collectionIds };
    }
  } else if (filters.collectionId) {
    // Eski collectionId desteği (geriye dönük uyumluluk)
    if (modelIds) {
      // Search sonuçlarını collectionId'ye göre filtrele
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collectionId: filters.collectionId,
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return 0;
      }
      modelFilter.id = { in: modelIds };
    } else if (!filters.subSeriesId) {
      // Sadece collectionId varsa ve subSeriesId yoksa, doğrudan collectionId kullan
      modelFilter.collectionId = filters.collectionId;
    }
  } else if (modelIds && !filters.subSeriesId) {
    // Sadece search varsa ve subSeriesId yoksa
    modelFilter.id = { in: modelIds };
  }

  // Gelişmiş filtreler için model filtreleri
  const advancedModelFilter: Prisma.ModelWhereInput = {};
  
  // Fiyat filtreleri
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceField = filters.priceType === 'loose' ? 'loosePrice' : 'packedPrice';
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      advancedModelFilter[priceField] = {
        gte: filters.minPrice,
        lte: filters.maxPrice,
      };
    } else if (filters.minPrice !== undefined) {
      advancedModelFilter[priceField] = { gte: filters.minPrice };
    } else if (filters.maxPrice !== undefined) {
      advancedModelFilter[priceField] = { lte: filters.maxPrice };
    }
  }

  // Görsel filtresi (model seviyesinde): yalnız belirli koleksiyonda; tüm koleksiyonlar + hasImage
  // için model.images boş kalan (Boulevard vb.) satırlar elenmesin — variant seviyesi yeterli.
  if (
    filters.hasImage === true &&
    !!filters.collectionName &&
    !collectionUsesVariantLevelPreviewImages(filters.collectionName)
  ) {
    advancedModelFilter.images = { some: {} };
  }

  // Not filtresi (model seviyesinde)
  if (filters.hasNotes === true) {
    advancedModelFilter.notes = { not: null };
  }

  // Model filtrelerini birleştir
  const finalModelFilter = {
    ...modelFilter,
    ...(Object.keys(advancedModelFilter).length > 0 ? advancedModelFilter : {}),
  };

  // Check if this is Team Transport collection
  let isTeamTransport = false;
  if (filters.collectionId) {
    const collection = await prisma.collection.findUnique({
      where: { id: filters.collectionId },
      select: { name: true }
    });
    isTeamTransport = collection?.name === 'Team Transport';
  }

  // For Team Transport: Filter out transport variants (only show car variants)
  // Transport variants have "Transport" in their releaseName
  const variantWhere: Prisma.VariantWhereInput = {
    year: filters.year ?? undefined,
    // TH and STH filter logic:
    // - If onlyTH is true and onlySTH is false: show only TH (isTreasureHunt: true, isSuperTreasureHunt: false)
    // - If onlyTH is false and onlySTH is true: show only STH (isTreasureHunt: false, isSuperTreasureHunt: true)
    // - If both are true: show both TH and STH (OR condition)
    // - If both are false: show all (no filter)
    ...(filters.onlyTH && !filters.onlySTH
      ? {
          isTreasureHunt: true,
          isSuperTreasureHunt: false,
        }
      : !filters.onlyTH && filters.onlySTH
      ? {
          isTreasureHunt: false,
          isSuperTreasureHunt: true,
        }
      : filters.onlyTH && filters.onlySTH
      ? {
          OR: [
            { isTreasureHunt: true, isSuperTreasureHunt: false },
            { isTreasureHunt: false, isSuperTreasureHunt: true },
          ],
        }
      : {}),
    packedOwned: filters.packedOwnedStatus ?? undefined,
    looseOwned: filters.looseOwnedStatus ?? undefined,
    wishlisted: filters.wishlistedStatus ?? undefined,
    model: Object.keys(finalModelFilter).length > 0 ? finalModelFilter : undefined,
    // Team Transport: hariç tut; hasImage: ilişkili görsel VEYA imageId (çakışan NOT anahtarı yok)
    ...(isTeamTransport || filters.hasImage === true
      ? {
          AND: [
            ...(isTeamTransport
              ? [
                  {
                    NOT: {
                      releaseName: {
                        contains: 'Transport',
                      },
                    },
                  },
                ]
              : []),
            ...(filters.hasImage === true
              ? [
                  {
                    NOT: {
                      AND: [{ images: { none: {} } }, { imageId: null }],
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
    // Not filtresi (variant seviyesinde)
    ...(filters.hasNotes === true
      ? {
          notes: {
            not: null,
          },
        }
      : {}),
  };

  return prisma.variant.count({
    where: variantWhere,
  });
}

// Tek varyantı id ile getir
export async function getVariantById(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new Error('Invalid variant ID');
  }

  const variant = await prisma.variant.findUnique({
    where: { id },
    include: {
      model: {
        include: {
          subSeries: { 
            include: { 
              collection: {
                include: {
                  year: true
                }
              } 
            } 
          }
        }
      },
      images: true
    }
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  return variant;
}

export async function createVariant(data: {
  modelId: number;
  year: number;
  releaseName?: string;
  color?: string;
  cardNumber?: string;
  isTreasureHunt?: boolean;
  isSuperTreasureHunt?: boolean;
  wheelType?: string;
  cardVariation?: string;
  owned?: boolean;
  quantity?: number;
  condition?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify model exists
    const model = await tx.model.findUnique({
      where: { id: data.modelId },
    });
    
    if (!model) {
      throw new Error('Model not found');
    }

    // Create variant
    const variant = await tx.variant.create({ data });
    
    return variant;
  });
}

export async function updateVariant(id: number, data: {
  year?: number;
  releaseName?: string;
  color?: string;
  cardNumber?: string;
  isTreasureHunt?: boolean;
  isSuperTreasureHunt?: boolean;
  wheelType?: string;
  cardVariation?: string;
  owned?: boolean;
  quantity?: number;
  condition?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify variant exists
    const existing = await tx.variant.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Variant not found');
    }

    // Update variant
    return tx.variant.update({
      where: { id },
      data
    });
  });
}

export async function deleteVariant(id: number) {
  return prisma.$transaction(async (tx) => {
    // Verify variant exists
    const existing = await tx.variant.findUnique({
      where: { id },
      include: { images: true },
    });
    
    if (!existing) {
      throw new Error('Variant not found');
    }

    // Delete associated images first (if any)
    if (existing.images.length > 0) {
      await tx.image.deleteMany({
        where: { variantId: id },
      });
    }

    // Delete variant
    return tx.variant.delete({ where: { id } });
  });
}

