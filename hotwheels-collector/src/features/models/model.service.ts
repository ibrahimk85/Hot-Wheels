import prisma from '@/db';
import { Prisma } from '@prisma/client';
import { mainlineOrdinalColorSortKey } from '@/lib/mainline-color-variant';

export interface ModelFilters {
  collectionName?: string;
  year?: number;
  subSeriesId?: number;
  subSeriesName?: string; // For Boulevard: filter by name across all years
  category?: string; // For Silver Series: 1st level filter (Anniversary, Automotive, etc.)
  ownedStatus?: boolean;
  wishlistedStatus?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  // Gelişmiş filtreler
  minPrice?: number;
  maxPrice?: number;
  priceType?: 'packed' | 'loose';
  hasImage?: boolean;
  hasNotes?: boolean;
  hasDescription?: boolean;
}

// Filtrelenmiş model listesi
export async function getModels(filters: ModelFilters) {
  // Eğer arama terimi varsa, case-insensitive arama için model ID'lerini bul
  let modelIds: number[] | undefined = undefined;
  
  if (filters.search) {
    const searchTerm = filters.search.trim();
    // SQLite'da case-insensitive arama için COLLATE NOCASE kullan
    const models = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM Model 
      WHERE castingName COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    modelIds = models.map(m => m.id);
    
    // Eğer hiç model bulunamadıysa, boş sonuç döndür
    if (modelIds.length === 0) {
      return [];
    }
  }

  // Koleksiyon filtresi için where clause oluştur
  const whereClause: Prisma.ModelWhereInput = {};

  // Collection name filtresi
  if (filters.collectionName) {
    if (modelIds) {
      // Search sonuçlarını collectionName'e göre filtrele
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collection: {
            name: filters.collectionName,
          },
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return [];
      }
      whereClause.id = { in: modelIds };
    } else {
      whereClause.collection = {
        name: filters.collectionName,
      };
    }
  } else if (modelIds) {
    whereClause.id = { in: modelIds };
  }

  // Year filtresi - Silver Series için özel mantık (Variant.year), diğerleri için Collection.year
  if (filters.year) {
    const isSilverSeries = filters.collectionName === 'Hot Wheels Silver Series';
    
    if (whereClause.collection && typeof whereClause.collection === 'object' && !Array.isArray(whereClause.collection)) {
      // Merge with existing collection filter
      if (isSilverSeries) {
        // Silver Series: Add variant year filter
        whereClause.collection = {
          ...whereClause.collection,
          name: 'Hot Wheels Silver Series',
        } as any;
        whereClause.variants = {
          some: {
            year: filters.year,
          },
        } as any;
      } else {
        whereClause.collection = {
          ...whereClause.collection,
          year: {
            year: filters.year,
          },
        } as any;
      }
    } else if (modelIds) {
      // If we have modelIds from search, filter by year
      if (isSilverSeries) {
        // Silver Series: Filter by variant year
        const modelsWithYear = await prisma.model.findMany({
          where: {
            id: { in: modelIds },
            collection: {
              name: 'Hot Wheels Silver Series',
            },
            variants: {
              some: {
                year: filters.year,
              },
            },
          },
          select: { id: true },
        });
        modelIds = modelsWithYear.map(m => m.id);
        if (modelIds.length === 0) {
          return [];
        }
        whereClause.id = { in: modelIds };
      } else {
        // Other collections: Filter by collection year
        const modelsWithYear = await prisma.model.findMany({
          where: {
            id: { in: modelIds },
            collection: {
              year: {
                year: filters.year,
              },
            },
          },
          select: { id: true },
        });
        modelIds = modelsWithYear.map(m => m.id);
        if (modelIds.length === 0) {
          return [];
        }
        whereClause.id = { in: modelIds };
      }
    } else {
      if (isSilverSeries) {
        // Silver Series: Filter by variant year
        whereClause.collection = {
          name: 'Hot Wheels Silver Series',
        };
        whereClause.variants = {
          some: {
            year: filters.year,
          },
        } as any;
      } else {
        whereClause.collection = {
          year: {
            year: filters.year,
          },
        };
      }
    }
  }

  // SubSeries filtresi - önce subSeriesName (Boulevard için tüm yıllardaki aynı isimli alt seriler)
  if (filters.subSeriesName) {
    const subSeriesWhere: any = {
      collection: { name: filters.collectionName },
    };
    const isSilverSeries = filters.collectionName === 'Hot Wheels Silver Series';
    if (isSilverSeries) {
      if (filters.category) subSeriesWhere.category = filters.category;
      subSeriesWhere.OR = [
        { name: filters.subSeriesName },
        { name: { startsWith: filters.subSeriesName + ' - ' } },
      ];
    } else {
      subSeriesWhere.name = filters.subSeriesName;
    }
    if (filters.year && !isSilverSeries) {
      subSeriesWhere.collection = {
        name: filters.collectionName,
        year: { year: filters.year },
      };
    }
    const subSeriesWithName = await prisma.subSeries.findMany({
      where: subSeriesWhere,
      select: { id: true },
    });
    const subSeriesIds = subSeriesWithName.map(ss => ss.id);
    if (subSeriesIds.length === 0) {
      return [];
    }
    
    if (modelIds) {
      const modelsWithSubSeries = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          subSeriesId: { in: subSeriesIds },
        },
        select: { id: true },
      });
      modelIds = modelsWithSubSeries.map(m => m.id);
      if (modelIds.length === 0) {
        return [];
      }
      whereClause.id = { in: modelIds };
    } else {
      whereClause.subSeriesId = { in: subSeriesIds };
    }
  } else if (filters.category && filters.collectionName === 'Hot Wheels Silver Series') {
    // Silver Series: filter by category only (no subSeriesName selected)
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
        whereClause.id = { in: modelIds };
      } else {
        whereClause.subSeriesId = { in: catSubSeriesIds };
      }
    }
  } else if (filters.subSeriesId) {
    if (modelIds) {
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
      whereClause.id = { in: modelIds };
    } else {
      whereClause.subSeriesId = filters.subSeriesId;
    }
  }

  // Owned status filtresi
  if (filters.ownedStatus !== undefined) {
    whereClause.owned = filters.ownedStatus;
  }

  // Wishlisted status filtresi
  if (filters.wishlistedStatus !== undefined) {
    whereClause.wishlisted = filters.wishlistedStatus;
  }

  // Gelişmiş filtreler
  // Fiyat filtreleri
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceField = filters.priceType === 'loose' ? 'loosePrice' : 'packedPrice';
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      whereClause[priceField] = {
        gte: filters.minPrice,
        lte: filters.maxPrice,
      } as any;
    } else if (filters.minPrice !== undefined) {
      whereClause[priceField] = { gte: filters.minPrice } as any;
    } else if (filters.maxPrice !== undefined) {
      whereClause[priceField] = { lte: filters.maxPrice } as any;
    }
  }

  // Görsel filtresi
  if (filters.hasImage === true) {
    whereClause.images = { some: {} } as any;
  }

  // Not filtresi
  if (filters.hasNotes === true) {
    whereClause.notes = { not: null } as any;
  }

  // Açıklama filtresi
  if (filters.hasDescription === true) {
    whereClause.description = { not: null } as any;
  }

  const cn = filters.collectionName;
  const variantImagesFull =
    cn === 'Elite 64' ||
    cn === 'Boulevard' ||
    cn === 'Fast & Furious' ||
    cn === 'Fast & Furious Premium' ||
    cn === 'Neon Speeders';

  const models = await prisma.model.findMany({
    where: whereClause,
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
        select: {
          id: true,
          cardNumber: true,
          color: true,
          toyNumber: true,
          year: true,
          imageId: true,
          images: variantImagesFull
            ? {
                select: {
                  id: true,
                  path: true,
                  alt: true,
                },
                orderBy: {
                  id: 'asc',
                },
              }
            : {
                take: 1,
                select: {
                  id: true,
                  path: true,
                  alt: true,
                },
              },
        },
        // Wiki order: COL# asc, then 1st → Nth color (NULL color = "1st"),
        // then Toy# as final tiebreaker.
        orderBy: [
          { cardNumber: 'asc' },
          { color: 'asc' },
          { toyNumber: 'asc' },
        ],
        // Get all variants to check for 2nd/3rd color
        // But limit to reasonable number to avoid performance issues
        take: 10,
      },
      images: true,
    },
    orderBy: {
      castingName: 'asc',
    },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });

  // Stable JS sort within each model's variant preview list — covers the rare
  // case of "10th Color" sorting before "2nd Color" alphabetically.
  for (const model of models) {
    if (model.variants && model.variants.length > 1) {
      model.variants = [...model.variants]
        .map((v, idx) => ({ v, idx }))
        .sort((a, b) => {
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
        .map(({ v }) => v);
    }
  }

  // Remove duplicates by model ID (safety check - should not happen but prevents UI issues)
  const uniqueModels = Array.from(
    new Map(models.map(model => [model.id, model])).values()
  );

  return uniqueModels;
}

// Filtrelenmiş model sayısı
export async function getModelsCount(filters: ModelFilters) {
  // Eğer arama terimi varsa, case-insensitive arama için model ID'lerini bul
  let modelIds: number[] | undefined = undefined;
  
  if (filters.search) {
    const searchTerm = filters.search.trim();
    const models = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM Model 
      WHERE castingName COLLATE NOCASE LIKE '%' || ${searchTerm} || '%'
    `;
    modelIds = models.map(m => m.id);
    
    // Eğer hiç model bulunamadıysa, 0 döndür
    if (modelIds.length === 0) {
      return 0;
    }
  }

  // Koleksiyon filtresi için where clause oluştur
  const whereClause: Prisma.ModelWhereInput = {};

  // Collection name filtresi
  if (filters.collectionName) {
    if (modelIds) {
      const modelsWithCollection = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          collection: {
            name: filters.collectionName,
          },
        },
        select: { id: true },
      });
      modelIds = modelsWithCollection.map(m => m.id);
      if (modelIds.length === 0) {
        return 0;
      }
      whereClause.id = { in: modelIds };
    } else {
      whereClause.collection = {
        name: filters.collectionName,
      };
    }
  } else if (modelIds) {
    whereClause.id = { in: modelIds };
  }

  // Year filtresi - Silver Series için özel mantık (Variant.year), diğerleri için Collection.year
  if (filters.year) {
    const isSilverSeries = filters.collectionName === 'Hot Wheels Silver Series';
    
    if (whereClause.collection && typeof whereClause.collection === 'object' && !Array.isArray(whereClause.collection)) {
      // Merge with existing collection filter
      if (isSilverSeries) {
        // Silver Series: Add variant year filter
        whereClause.collection = {
          ...whereClause.collection,
          name: 'Hot Wheels Silver Series',
        } as any;
        whereClause.variants = {
          some: {
            year: filters.year,
          },
        } as any;
      } else {
        whereClause.collection = {
          ...whereClause.collection,
          year: {
            year: filters.year,
          },
        } as any;
      }
    } else if (modelIds) {
      // If we have modelIds from search, filter by year
      if (isSilverSeries) {
        // Silver Series: Filter by variant year
        const modelsWithYear = await prisma.model.findMany({
          where: {
            id: { in: modelIds },
            collection: {
              name: 'Hot Wheels Silver Series',
            },
            variants: {
              some: {
                year: filters.year,
              },
            },
          },
          select: { id: true },
        });
        modelIds = modelsWithYear.map(m => m.id);
        if (modelIds.length === 0) {
          return 0;
        }
        whereClause.id = { in: modelIds };
      } else {
        // Other collections: Filter by collection year
        const modelsWithYear = await prisma.model.findMany({
          where: {
            id: { in: modelIds },
            collection: {
              year: {
                year: filters.year,
              },
            },
          },
          select: { id: true },
        });
        modelIds = modelsWithYear.map(m => m.id);
        if (modelIds.length === 0) {
          return 0;
        }
        whereClause.id = { in: modelIds };
      }
    } else {
      if (isSilverSeries) {
        // Silver Series: Filter by variant year
        whereClause.collection = {
          name: 'Hot Wheels Silver Series',
        };
        whereClause.variants = {
          some: {
            year: filters.year,
          },
        } as any;
      } else {
        whereClause.collection = {
          year: {
            year: filters.year,
          },
        };
      }
    }
  }

  // SubSeries filtresi - önce subSeriesName (Boulevard için tüm yıllardaki aynı isimli alt seriler)
  if (filters.subSeriesName) {
    const subSeriesWhere: any = {
      collection: { name: filters.collectionName },
    };
    const isSilverSeries = filters.collectionName === 'Hot Wheels Silver Series';
    if (isSilverSeries) {
      if (filters.category) subSeriesWhere.category = filters.category;
      subSeriesWhere.OR = [
        { name: filters.subSeriesName },
        { name: { startsWith: filters.subSeriesName + ' - ' } },
      ];
    } else {
      subSeriesWhere.name = filters.subSeriesName;
    }
    if (filters.year && !isSilverSeries) {
      subSeriesWhere.collection = {
        name: filters.collectionName,
        year: { year: filters.year },
      };
    }
    const subSeriesWithName = await prisma.subSeries.findMany({
      where: subSeriesWhere,
      select: { id: true },
    });
    const subSeriesIds = subSeriesWithName.map(ss => ss.id);
    if (subSeriesIds.length === 0) {
      return 0;
    }
    if (modelIds) {
      const modelsWithSubSeries = await prisma.model.findMany({
        where: {
          id: { in: modelIds },
          subSeriesId: { in: subSeriesIds },
        },
        select: { id: true },
      });
      modelIds = modelsWithSubSeries.map(m => m.id);
      if (modelIds.length === 0) return 0;
      whereClause.id = { in: modelIds };
    } else {
      whereClause.subSeriesId = { in: subSeriesIds };
    }
  } else if (filters.category && filters.collectionName === 'Hot Wheels Silver Series') {
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
        if (modelIds.length === 0) return 0;
        whereClause.id = { in: modelIds };
      } else {
        whereClause.subSeriesId = { in: catSubSeriesIds };
      }
    }
  } else if (filters.subSeriesId) {
    if (modelIds) {
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
      whereClause.id = { in: modelIds };
    } else {
      whereClause.subSeriesId = filters.subSeriesId;
    }
  }

  // Owned status filtresi
  if (filters.ownedStatus !== undefined) {
    whereClause.owned = filters.ownedStatus;
  }

  // Wishlisted status filtresi
  if (filters.wishlistedStatus !== undefined) {
    whereClause.wishlisted = filters.wishlistedStatus;
  }

  // Gelişmiş filtreler
  // Fiyat filtreleri
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceField = filters.priceType === 'loose' ? 'loosePrice' : 'packedPrice';
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      whereClause[priceField] = {
        gte: filters.minPrice,
        lte: filters.maxPrice,
      } as any;
    } else if (filters.minPrice !== undefined) {
      whereClause[priceField] = { gte: filters.minPrice } as any;
    } else if (filters.maxPrice !== undefined) {
      whereClause[priceField] = { lte: filters.maxPrice } as any;
    }
  }

  // Görsel filtresi
  if (filters.hasImage === true) {
    whereClause.images = { some: {} } as any;
  }

  // Not filtresi
  if (filters.hasNotes === true) {
    whereClause.notes = { not: null } as any;
  }

  // Açıklama filtresi
  if (filters.hasDescription === true) {
    whereClause.description = { not: null } as any;
  }

  return prisma.model.count({
    where: whereClause,
  });
}

export async function getModelById(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new Error('Invalid model ID');
  }

  const model = await prisma.model.findUnique({
    where: { id },
    include: {
      collection: {
        include: {
          year: true
        }
      },
      subSeries: { 
        include: { 
          collection: {
            include: {
              year: true
            }
          } 
        } 
      },
      variants: {
        include: {
          images: {
            orderBy: {
              id: 'asc'
            }
          }
        },
        // Wiki order: year desc, then COL# asc, then 1st → Nth color, then Toy# asc.
        // SQLite ASC puts NULLs first, which corresponds to the "1st color" row
        // (no "(Nth Color)" suffix). JS post-sort below handles ordinals robustly.
        orderBy: [
          { year: 'desc' },
          { cardNumber: 'asc' },
          { color: 'asc' },
          { toyNumber: 'asc' },
        ]
      },
      images: true
    }
  });

  if (!model) {
    throw new Error('Model not found');
  }

  // Stable JS sort by ordinal color key for variant rows that share the same
  // (year, cardNumber). Handles "10th Color" vs "2nd Color" correctly where
  // alphabetic SQL sort would not.
  if (model.variants.length > 1) {
    model.variants = [...model.variants]
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
      .map(({ v }) => v);
  }

  return model;
}

export async function createModel(data: {
  castingName: string;
  castingId?: string;
  description?: string;
  collectionId: number;
  subSeriesId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify collection exists
    const collection = await tx.collection.findUnique({
      where: { id: data.collectionId },
    });
    
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Verify subSeries exists if provided
    if (data.subSeriesId) {
      const subSeries = await tx.subSeries.findUnique({
        where: { id: data.subSeriesId },
      });
      
      if (!subSeries) {
        throw new Error('SubSeries not found');
      }

      // Verify subSeries belongs to collection
      if (subSeries.collectionId !== data.collectionId) {
        throw new Error('SubSeries does not belong to the specified collection');
      }
    }

    // Create model
    return tx.model.create({ data });
  });
}

export async function updateModel(id: number, data: {
  castingName?: string;
  castingId?: string;
  description?: string;
  subSeriesId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    // Verify model exists
    const existing = await tx.model.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Model not found');
    }

    // Verify subSeries exists if provided
    if (data.subSeriesId) {
      const subSeries = await tx.subSeries.findUnique({
        where: { id: data.subSeriesId },
      });
      
      if (!subSeries) {
        throw new Error('SubSeries not found');
      }

      // Verify subSeries belongs to same collection
      if (subSeries.collectionId !== existing.collectionId) {
        throw new Error('SubSeries does not belong to the model\'s collection');
      }
    }

    // Update model
    return tx.model.update({ where: { id }, data });
  });
}

export async function deleteModel(id: number) {
  return prisma.$transaction(async (tx) => {
    // Verify model exists and get related data
    const existing = await tx.model.findUnique({
      where: { id },
      include: {
        variants: {
          include: { images: true },
        },
        images: true,
      },
    });
    
    if (!existing) {
      throw new Error('Model not found');
    }

    // Delete model images
    if (existing.images.length > 0) {
      await tx.image.deleteMany({
        where: { modelId: id },
      });
    }

    // Delete variant images
    for (const variant of existing.variants) {
      if (variant.images.length > 0) {
        await tx.image.deleteMany({
          where: { variantId: variant.id },
        });
      }
    }

    // Delete variants
    if (existing.variants.length > 0) {
      await tx.variant.deleteMany({
        where: { modelId: id },
      });
    }

    // Delete model
    return tx.model.delete({ where: { id } });
  });
}

// Helper function to check if a sub-series name is a variant
function isVariantSubSeries(name: string): boolean {
  const variantPatterns = [
    /2nd\s+color/i,
    /3rd\s+color/i,
    /4th\s+color/i,
    /kroger\s+exclusive/i,
    /walmart\s+exclusive/i,
    /target\s+exclusive/i,
    /super\s+treasure\s+hunt/i,
    /treasure\s+hunt/i,
    /\bsth\b/i,
    /\bth\b/i,
  ];
  return variantPatterns.some((pattern) => pattern.test(name));
}

// Helper function to normalize sub-series name for comparison
function normalizeSubSeriesName(name: string): string {
  // Remove common suffixes that indicate variants
  return name
    .replace(/\s*new\s+for\s+\d+!?/gi, '')
    .replace(/\s*for\s+\d+!?/gi, '')
    .trim();
}

// Get all sub-series with their model counts and a random model image
// Groups variant sub-series (2nd color, Kroger Exclusive, STH, etc.) under their main sub-series
// Also groups sub-series by name across different years
export async function getAllSubSeries() {
  try {
    const subSeriesList = await prisma.subSeries.findMany({
      include: {
        collection: {
          include: {
            year: true,
          },
        },
        models: {
          select: {
            id: true,
            castingName: true,
            castingId: true,
            variants: {
              include: {
                images: {
                  take: 1,
                },
              },
            },
          },
        },
        _count: {
          select: {
            models: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Filter Boulevard to only show 2024, 2025 and 2026 years
    const filteredSubSeriesList = subSeriesList.filter((subSeries) => {
      const collectionName = subSeries.collection.name;
      const year = subSeries.collection.year.year;
      
      // For Boulevard, only include 2024, 2025 and 2026 years
      if (collectionName === 'Boulevard' && year !== 2024 && year !== 2025 && year !== 2026) {
        return false;
      }
      
      return true;
    });

    // Group sub-series by collection and normalize names
    const groupedByCollection = new Map<number, typeof filteredSubSeriesList>();
    
    for (const subSeries of filteredSubSeriesList) {
      const collectionId = subSeries.collectionId;
      if (!groupedByCollection.has(collectionId)) {
        groupedByCollection.set(collectionId, []);
      }
      groupedByCollection.get(collectionId)!.push(subSeries);
    }

    const mainSubSeries: typeof subSeriesList = [];

    // Process each collection group
    for (const [collectionId, subSeriesInCollection] of groupedByCollection.entries()) {
      // Find main sub-series (non-variants)
      const mainSeries = subSeriesInCollection.filter(
        (ss) => !isVariantSubSeries(ss.name)
      );

      // Find variant sub-series
      const variantSeries = subSeriesInCollection.filter(
        (ss) => isVariantSubSeries(ss.name)
      );

      // For each main sub-series, find its variants and merge them
      for (const main of mainSeries) {
        const normalizedMainName = normalizeSubSeriesName(main.name);
        
        // Find variants that belong to this main sub-series
        const relatedVariants = variantSeries.filter((variant) => {
          const normalizedVariantName = normalizeSubSeriesName(variant.name);
          // Check if variant name starts with main name or main name is contained in variant
          return (
            normalizedVariantName.startsWith(normalizedMainName) ||
            normalizedMainName.startsWith(normalizedVariantName) ||
            variant.name.toLowerCase().includes(normalizedMainName.toLowerCase())
          );
        });

        // Merge models from variants into main sub-series
        const allModels = [...main.models];
        let totalModelCount = main._count.models;

        for (const variant of relatedVariants) {
          allModels.push(...variant.models);
          totalModelCount += variant._count.models;
        }

        // Create merged sub-series
        const mergedSubSeries = {
          ...main,
          models: allModels,
          _count: {
            models: totalModelCount,
          },
        };

        mainSubSeries.push(mergedSubSeries);
      }

      // Add standalone variant sub-series that don't match any main sub-series
      for (const variant of variantSeries) {
        const normalizedVariantName = normalizeSubSeriesName(variant.name);
        const hasMainSeries = mainSeries.some((main) => {
          const normalizedMainName = normalizeSubSeriesName(main.name);
          return (
            normalizedVariantName.startsWith(normalizedMainName) ||
            normalizedMainName.startsWith(normalizedVariantName) ||
            variant.name.toLowerCase().includes(normalizedMainName.toLowerCase())
          );
        });

        if (!hasMainSeries) {
          mainSubSeries.push(variant);
        }
      }
    }

    // Now group sub-series by normalized name across years
    const groupedByName = new Map<string, typeof mainSubSeries>();
    
    for (const subSeries of mainSubSeries) {
      const normalizedName = normalizeSubSeriesName(subSeries.name);
      if (!groupedByName.has(normalizedName)) {
        groupedByName.set(normalizedName, []);
      }
      groupedByName.get(normalizedName)!.push(subSeries);
    }

    // For each grouped sub-series, select a random model with an image
    const result = [];
    for (const [normalizedName, subSeriesGroup] of groupedByName.entries()) {
      // Sort by year descending
      subSeriesGroup.sort((a, b) => b.collection.year.year - a.collection.year.year);
      
      // Use the first (most recent) sub-series as the primary one
      const primarySubSeries = subSeriesGroup[0];
      
      // Get all years this sub-series appears in
      const years = subSeriesGroup.map(ss => ss.collection.year.year);
      const hasMultipleYears = years.length > 1;
      
      // Collect all models from all years in this sub-series group
      const allModelsFromAllYears: typeof primarySubSeries.models = [];
      for (const subSeries of subSeriesGroup) {
        allModelsFromAllYears.push(...subSeries.models);
      }
      
      // Calculate total unique model count (by model ID to avoid duplicates across years)
      const uniqueModelIds = new Set(allModelsFromAllYears.map(m => m.id));
      const totalModelCount = uniqueModelIds.size;
      
      // Filter models that have at least one variant with an image
      // Check all variants, not just the first one
      // Use models from ALL years, not just the primary year
      const modelsWithImages = allModelsFromAllYears.filter((model) => {
        if (!model.variants || model.variants.length === 0) {
          return false;
        }
        // Check if any variant has an image
        return model.variants.some((variant) => variant.images && variant.images.length > 0);
      });

      // Select a random model with an image if available
      let randomModel = null;
      let randomModelImage = null;
      
      if (modelsWithImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * modelsWithImages.length);
        randomModel = modelsWithImages[randomIndex];
        
        // Find the first variant with an image from the selected model
        const variantWithImage = randomModel.variants.find(
          (variant) => variant.images && variant.images.length > 0
        );
        
        if (variantWithImage && variantWithImage.images && variantWithImage.images.length > 0) {
          randomModelImage = variantWithImage.images[0];
        }
      }

      result.push({
        ...primarySubSeries,
        models: allModelsFromAllYears, // Tüm yıllardaki modelleri ekle
        _count: {
          models: totalModelCount, // Benzersiz model sayısını kullan
        },
        randomModelImage: randomModelImage,
        years: years,
        hasMultipleYears: hasMultipleYears,
      });
    }

    // Filter out sub-series with 0 models
    const filteredResult = result.filter((ss) => ss._count.models > 0);

    return filteredResult.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in getAllSubSeries:', error);
    throw error;
  }
}

export interface CompletionPreviewImage {
  path: string;
  alt: string | null;
}

export interface SubSeriesCompletionSummaryItem {
  groupKey: string;
  subSeriesId: number;
  subSeriesName: string;
  collectionName: string;
  year: number;
  totalVariants: number;
  packedOwnedVariants: number;
  missingVariants: number;
  totalModels: number;
  packedOwnedModels: number;
  missingModels: number;
  completionPercentage: number;
  modelCompletionPercentage: number;
  isCompleted: boolean;
  previewImages: CompletionPreviewImage[];
}

export interface SubSeriesCompletionDetailItem {
  modelId: number;
  modelName: string;
  variantId: number;
  releaseName: string | null;
  cardNumber: string | null;
  toyNumber: string | null;
  packedOwned: boolean;
  image: CompletionPreviewImage | null;
}

function getFirstVariantImage(
  variant: { images: Array<{ path: string; alt: string | null }> },
  model: { images?: Array<{ path: string; alt: string | null }> }
): CompletionPreviewImage | null {
  if (variant.images.length > 0) {
    return {
      path: variant.images[0].path,
      alt: variant.images[0].alt,
    };
  }

  if (model.images && model.images.length > 0) {
    return {
      path: model.images[0].path,
      alt: model.images[0].alt,
    };
  }

  return null;
}

export async function getSubSeriesCompletionSummary(): Promise<SubSeriesCompletionSummaryItem[]> {
  const subSeriesList = await prisma.subSeries.findMany({
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      models: {
        select: {
          id: true,
          castingName: true,
          images: {
            select: {
              path: true,
              alt: true,
            },
            orderBy: {
              id: 'asc',
            },
          },
          variants: {
            select: {
              id: true,
              packedOwned: true,
              images: {
                select: {
                  path: true,
                  alt: true,
                },
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      {
        collection: {
          year: {
            year: 'desc',
          },
        },
      },
      {
        collection: {
          name: 'asc',
        },
      },
      {
        name: 'asc',
      },
    ],
  });

  const mainlineByCollection = new Map<number, typeof subSeriesList>();
  const nonMainlineSubSeries: typeof subSeriesList = [];

  for (const subSeries of subSeriesList) {
    if (subSeries.collection.name === 'Mainline') {
      const list = mainlineByCollection.get(subSeries.collectionId) ?? [];
      list.push(subSeries);
      mainlineByCollection.set(subSeries.collectionId, list);
    } else {
      nonMainlineSubSeries.push(subSeries);
    }
  }

  const nonMainlineSummary = nonMainlineSubSeries
    .map((subSeries) => {
      const allVariants = subSeries.models.flatMap((model) => model.variants);
      const totalVariants = allVariants.length;

      if (totalVariants === 0) {
        return null;
      }

      const packedOwnedVariants = allVariants.filter((variant) => variant.packedOwned).length;
      const missingVariants = totalVariants - packedOwnedVariants;
      const completionPercentage = totalVariants > 0 ? (packedOwnedVariants / totalVariants) * 100 : 0;
      const totalModels = subSeries.models.length;
      const packedOwnedModels = subSeries.models.filter((model) =>
        model.variants.some((variant) => variant.packedOwned)
      ).length;
      const missingModels = totalModels - packedOwnedModels;
      const modelCompletionPercentage = totalModels > 0 ? (packedOwnedModels / totalModels) * 100 : 0;
      const isCompleted = missingVariants === 0;

      const previewImages: CompletionPreviewImage[] = [];
      const seenPaths = new Set<string>();

      for (const model of subSeries.models) {
        for (const variant of model.variants) {
          const image = getFirstVariantImage(variant, model);
          if (!image || seenPaths.has(image.path)) {
            continue;
          }
          previewImages.push(image);
          seenPaths.add(image.path);
          if (previewImages.length >= 4) {
            break;
          }
        }
        if (previewImages.length >= 4) {
          break;
        }
      }

      return {
        groupKey: `${subSeries.collection.name}-${subSeries.collection.year.year}-${subSeries.id}`,
        subSeriesId: subSeries.id,
        subSeriesName: subSeries.name,
        collectionName: subSeries.collection.name,
        year: subSeries.collection.year.year,
        totalVariants,
        packedOwnedVariants,
        missingVariants,
        totalModels,
        packedOwnedModels,
        missingModels,
        completionPercentage,
        modelCompletionPercentage,
        isCompleted,
        previewImages,
      } satisfies SubSeriesCompletionSummaryItem;
    })
    .filter((item): item is SubSeriesCompletionSummaryItem => item !== null);

  const mainlineSummary: SubSeriesCompletionSummaryItem[] = [];
  for (const [collectionId, groupedSubSeries] of mainlineByCollection.entries()) {
    const representative = groupedSubSeries[0];
    const allModels = groupedSubSeries.flatMap((subSeries) => subSeries.models);
    const allVariants = allModels.flatMap((model) => model.variants);
    const totalVariants = allVariants.length;

    if (totalVariants === 0) {
      continue;
    }

    const packedOwnedVariants = allVariants.filter((variant) => variant.packedOwned).length;
    const missingVariants = totalVariants - packedOwnedVariants;
    const completionPercentage = totalVariants > 0 ? (packedOwnedVariants / totalVariants) * 100 : 0;
    const totalModels = allModels.length;
    const packedOwnedModels = allModels.filter((model) =>
      model.variants.some((variant) => variant.packedOwned)
    ).length;
    const missingModels = totalModels - packedOwnedModels;
    const modelCompletionPercentage = totalModels > 0 ? (packedOwnedModels / totalModels) * 100 : 0;
    const isCompleted = missingVariants === 0;

    const previewImages: CompletionPreviewImage[] = [];
    const seenPaths = new Set<string>();
    for (const model of allModels) {
      for (const variant of model.variants) {
        const image = getFirstVariantImage(variant, model);
        if (!image || seenPaths.has(image.path)) {
          continue;
        }
        previewImages.push(image);
        seenPaths.add(image.path);
        if (previewImages.length >= 4) {
          break;
        }
      }
      if (previewImages.length >= 4) {
        break;
      }
    }

    mainlineSummary.push({
      groupKey: `Mainline-${representative.collection.year.year}-${collectionId}`,
      subSeriesId: representative.id,
      subSeriesName: 'Mainline',
      collectionName: representative.collection.name,
      year: representative.collection.year.year,
      totalVariants,
      packedOwnedVariants,
      missingVariants,
      totalModels,
      packedOwnedModels,
      missingModels,
      completionPercentage,
      modelCompletionPercentage,
      isCompleted,
      previewImages,
    });
  }

  return [...nonMainlineSummary, ...mainlineSummary];
}

export async function getSubSeriesCompletionDetails(
  subSeriesId: number,
  year: number
): Promise<SubSeriesCompletionDetailItem[]> {
  const subSeries = await prisma.subSeries.findUnique({
    where: { id: subSeriesId },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      models: {
        select: {
          id: true,
          castingName: true,
          images: {
            select: {
              path: true,
              alt: true,
            },
            orderBy: {
              id: 'asc',
            },
          },
          variants: {
            select: {
              id: true,
              releaseName: true,
              cardNumber: true,
              toyNumber: true,
              packedOwned: true,
              images: {
                select: {
                  path: true,
                  alt: true,
                },
                orderBy: {
                  id: 'asc',
                },
              },
            },
            orderBy: {
              id: 'asc',
            },
          },
        },
        orderBy: {
          castingName: 'asc',
        },
      },
    },
  });

  if (!subSeries) {
    return [];
  }

  // Guard against incorrect query usage from UI links.
  if (subSeries.collection.year.year !== year) {
    return [];
  }

  let modelsToUse = subSeries.models;

  // Mainline completion card represents the whole year, not a single sub-series.
  if (subSeries.collection.name === 'Mainline') {
    const allMainlineSubSeriesInYear = await prisma.subSeries.findMany({
      where: {
        collectionId: subSeries.collectionId,
      },
      include: {
        models: {
          select: {
            id: true,
            castingName: true,
            images: {
              select: {
                path: true,
                alt: true,
              },
              orderBy: {
                id: 'asc',
              },
            },
            variants: {
              select: {
                id: true,
                releaseName: true,
                cardNumber: true,
                toyNumber: true,
                packedOwned: true,
                images: {
                  select: {
                    path: true,
                    alt: true,
                  },
                  orderBy: {
                    id: 'asc',
                  },
                },
              },
              orderBy: {
                id: 'asc',
              },
            },
          },
          orderBy: {
            castingName: 'asc',
          },
        },
      },
    });

    modelsToUse = allMainlineSubSeriesInYear.flatMap((item) => item.models);
  }

  const details: SubSeriesCompletionDetailItem[] = [];
  for (const model of modelsToUse) {
    for (const variant of model.variants) {
      details.push({
        modelId: model.id,
        modelName: model.castingName,
        variantId: variant.id,
        releaseName: variant.releaseName,
        cardNumber: variant.cardNumber,
        toyNumber: variant.toyNumber,
        packedOwned: variant.packedOwned,
        image: getFirstVariantImage(variant, model),
      });
    }
  }

  return details.sort((a, b) => {
    if (a.packedOwned === b.packedOwned) {
      return a.modelName.localeCompare(b.modelName);
    }
    return a.packedOwned ? 1 : -1;
  });
}

// Get years for a specific sub-series
// This function finds all sub-series with the same normalized name across all years
export async function getYearsBySubSeries(subSeriesId: number) {
  const subSeries = await prisma.subSeries.findUnique({
    where: { id: subSeriesId },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
  });

  if (!subSeries) {
    return [];
  }

  // Normalize the sub-series name to find all matching sub-series across years
  const normalizedName = normalizeSubSeriesName(subSeries.name);
  const collectionName = subSeries.collection.name; // e.g., "Mainline"

  // Find all sub-series in the same collection type (e.g., all "Mainline" sub-series)
  // This reduces the dataset we need to filter
  const allSubSeries = await prisma.subSeries.findMany({
    where: {
      collection: {
        name: collectionName,
      },
    },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      _count: {
        select: {
          models: true,
        },
      },
    },
  });

  // Filter sub-series by normalized name
  const matchingSubSeries = allSubSeries.filter((ss) => {
    const ssNormalizedName = normalizeSubSeriesName(ss.name);
    return ssNormalizedName === normalizedName;
  });

  // Get unique years and count models for each year
  const years = new Map<number, { year: number; modelCount: number }>();
  
  for (const matchingSS of matchingSubSeries) {
    const year = matchingSS.collection.year.year;
    const modelCount = matchingSS._count.models;
    
    if (years.has(year)) {
      years.get(year)!.modelCount += modelCount;
    } else {
      years.set(year, { year, modelCount });
    }
  }

  return Array.from(years.values()).sort((a, b) => b.year - a.year);
}

// Get all models for a sub-series across all years
// This function finds all sub-series with the same normalized name across all years and returns all models
export async function getModelsBySubSeries(subSeriesId: number) {
  // First, get the sub-series to normalize its name and get collection name
  const subSeries = await prisma.subSeries.findUnique({
    where: { id: subSeriesId },
    include: {
      collection: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!subSeries) {
    return [];
  }

  // Normalize the sub-series name to find matching sub-series across all years
  const normalizedName = normalizeSubSeriesName(subSeries.name);
  const collectionName = subSeries.collection.name; // e.g., "Mainline"

  // Find all collections with the same name
  const collections = await prisma.collection.findMany({
    where: {
      name: collectionName,
    },
    include: {
      year: true,
      subSeries: true,
    },
  });

  // Find all matching sub-series across all years
  const matchingSubSeriesIds: number[] = [];
  for (const collection of collections) {
    const matchingSubSeries = collection.subSeries.find((ss) => {
      const ssNormalizedName = normalizeSubSeriesName(ss.name);
      return ssNormalizedName === normalizedName;
    });
    if (matchingSubSeries) {
      matchingSubSeriesIds.push(matchingSubSeries.id);
    }
  }

  if (matchingSubSeriesIds.length === 0) {
    return [];
  }

  // Check if this is Team Transport collection
  const isTeamTransport = collectionName === 'Team Transport';
  const variantLevelPreview =
    collectionName === 'Boulevard' ||
    collectionName === 'Fast & Furious' ||
    collectionName === 'Neon Speeders';

  // Get all models from all matching sub-series across all years
  // For Team Transport: Include all variants and all images
  // For Boulevard / F&F / Neon: variant carded+loose — need full variant images + imageId
  // For other collections: Include only first variant with first image (for performance)
  return prisma.model.findMany({
    where: {
      subSeriesId: { in: matchingSubSeriesIds },
    },
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
      variants: isTeamTransport || variantLevelPreview
        ? {
            include: {
              images: {
                orderBy: { id: 'asc' as const },
              },
            },
            orderBy: {
              id: 'asc',
            },
          }
        : {
            include: {
              images: {
                take: 1,
              },
            },
            take: 1,
          },
      images: isTeamTransport
        ? true
        : variantLevelPreview
          ? {
              select: {
                id: true,
                path: true,
                alt: true,
              },
              orderBy: { id: 'asc' as const },
            }
          : false,
      _count: {
        select: {
          variants: true,
        },
      },
    },
    orderBy: [
      {
        subSeries: {
          collection: {
            year: {
              year: 'desc',
            },
          },
        },
      },
      {
        castingName: 'asc',
      },
    ],
  });
}

// Get models for a specific sub-series and year
// This function finds the sub-series with the same normalized name in the specified year
export async function getModelsBySubSeriesAndYear(subSeriesId: number, year: number) {
  // First, get the sub-series to normalize its name and get collection name
  const subSeries = await prisma.subSeries.findUnique({
    where: { id: subSeriesId },
    include: {
      collection: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!subSeries) {
    return [];
  }

  // Normalize the sub-series name to find matching sub-series in the specified year
  const normalizedName = normalizeSubSeriesName(subSeries.name);
  const collectionName = subSeries.collection.name; // e.g., "Mainline"

  // Find the collection for the specified year and collection name
  const collection = await prisma.collection.findFirst({
    where: {
      name: collectionName,
      year: {
        year: year,
      },
    },
    include: {
      subSeries: true,
    },
  });

  if (!collection) {
    return [];
  }

  // Find the sub-series with the same normalized name in this collection
  const matchingSubSeries = collection.subSeries.find((ss) => {
    const ssNormalizedName = normalizeSubSeriesName(ss.name);
    return ssNormalizedName === normalizedName;
  });

  if (!matchingSubSeries) {
    return [];
  }

  const variantLevelPreviewYearPage =
    collectionName === 'Boulevard' ||
    collectionName === 'Fast & Furious' ||
    collectionName === 'Fast & Furious Premium' ||
    collectionName === 'Neon Speeders';

  // Get models from the matching sub-series in the specified year
  return prisma.model.findMany({
    where: {
      subSeriesId: matchingSubSeries.id,
      collectionId: collection.id,
    },
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
        include: {
          images: variantLevelPreviewYearPage
            ? {
                orderBy: { id: 'asc' as const },
              }
            : {
                take: 1,
              },
        },
        take: 1,
      },
      images: variantLevelPreviewYearPage
        ? {
            select: {
              id: true,
              path: true,
              alt: true,
            },
            orderBy: { id: 'asc' as const },
          }
        : false,
      _count: {
        select: {
          variants: true,
        },
      },
    },
    orderBy: {
      castingName: 'asc',
    },
  });
}

// Get sub-series by ID with collection info
export async function getSubSeriesById(id: number) {
  return prisma.subSeries.findUnique({
    where: { id },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
  });
}

// Get models with missing images (no images at model level AND no images at variant level)
export async function getModelsWithMissingImages(filters: ModelFilters) {
  // Build the same filters as getModels, but add missing image filter
  const baseFilters = { ...filters };
  
  // Get all models with the base filters
  const allModels = await getModels(baseFilters);
  
  // Filter to only models with missing images
  const modelsWithMissingImages = allModels.filter((model) => {
    // Model has no images at all
    const hasNoModelImages = !model.images || model.images.length === 0;
    
    // Model has no mainImageId
    const hasNoMainImage = !model.mainImageId;
    
    // Check if any variant has images
    const hasVariantImages = model.variants && model.variants.some((variant: any) => 
      variant.images && variant.images.length > 0
    );
    
    // Model is missing images if:
    // 1. Model has no images AND no mainImageId
    // 2. AND no variant has images
    return (hasNoModelImages || hasNoMainImage) && !hasVariantImages;
  });
  
  return modelsWithMissingImages;
}

// Get count of models with missing images
export async function getModelsWithMissingImagesCount(filters: ModelFilters) {
  // Build the same filters as getModelsCount, but add missing image filter
  const baseFilters = { ...filters };
  
  // Get all models with the base filters
  const allModels = await getModels(baseFilters);
  
  // Filter to only models with missing images and return count
  const modelsWithMissingImages = allModels.filter((model) => {
    const hasNoModelImages = !model.images || model.images.length === 0;
    const hasNoMainImage = !model.mainImageId;
    
    // Check if any variant has images
    const hasVariantImages = model.variants && model.variants.some((variant: any) => 
      variant.images && variant.images.length > 0
    );
    
    // Model is missing images if:
    // 1. Model has no images AND no mainImageId
    // 2. AND no variant has images
    return (hasNoModelImages || hasNoMainImage) && !hasVariantImages;
  });
  
  return modelsWithMissingImages.length;
}