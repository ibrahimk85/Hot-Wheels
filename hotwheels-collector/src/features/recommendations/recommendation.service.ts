import prisma from '@/db';

export interface SimilarModel {
  id: number;
  castingName: string;
  castingId: string | null;
  subSeries: {
    name: string;
    collection: {
      name: string;
      year: {
        year: number;
      };
    };
  } | null;
  variants: Array<{
    id: number;
    year: number;
    color: string | null;
    images: Array<{ path: string }>;
  }>;
  similarityScore: number;
}

export interface MissingModel {
  id: number;
  castingName: string;
  castingId: string | null;
  subSeries: {
    name: string;
    collection: {
      name: string;
      year: {
        year: number;
      };
    };
  } | null;
  variants: Array<{
    id: number;
    year: number;
    color: string | null;
    images: Array<{ path: string }>;
  }>;
}

export interface CompletionSuggestion {
  subSeriesId: number;
  subSeriesName: string;
  collectionName: string;
  year: number;
  totalModels: number;
  ownedModels: number;
  missingModels: number;
  completionPercentage: number;
  missingModelList: MissingModel[];
}

/**
 * Belirli bir modele benzer modelleri bulur
 */
export async function getSimilarModels(
  modelId: number,
  limit: number = 10
): Promise<SimilarModel[]> {
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
        include: {
          images: {
            take: 1,
          },
        },
      },
    },
  });

  if (!model) {
    return [];
  }

  const subSeriesId = model.subSeriesId;
  const collectionId = model.collectionId;
  const year = model.subSeries?.collection.year.year;

  // Aynı SubSeries'ten modeller (en yüksek benzerlik)
  const sameSubSeriesModels = subSeriesId
    ? await prisma.model.findMany({
        where: {
          id: { not: modelId },
          subSeriesId: subSeriesId,
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
              images: {
                take: 1,
              },
            },
          },
        },
        take: limit,
      })
    : [];

  // Aynı Collection'dan modeller
  const sameCollectionModels = await prisma.model.findMany({
    where: {
      id: { not: modelId },
      collectionId: collectionId,
      ...(subSeriesId ? { subSeriesId: { not: subSeriesId } } : {}),
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
          images: {
            take: 1,
          },
        },
      },
    },
    take: limit,
  });

  // Aynı yıldan modeller
  const sameYearModels = year
    ? await prisma.model.findMany({
        where: {
          id: { not: modelId },
          collection: {
            year: {
              year: year,
            },
          },
          collectionId: { not: collectionId },
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
              images: {
                take: 1,
              },
            },
          },
        },
        take: limit,
      })
    : [];

  // Benzerlik skorları ile birleştir
  const similarModels: SimilarModel[] = [];

  // Aynı SubSeries'ten modeller (skor: 100)
  sameSubSeriesModels.forEach((m) => {
    similarModels.push({
      ...m,
      similarityScore: 100,
    });
  });

  // Aynı Collection'dan modeller (skor: 70)
  sameCollectionModels.forEach((m) => {
    if (!similarModels.find((sm) => sm.id === m.id)) {
      similarModels.push({
        ...m,
        similarityScore: 70,
      });
    }
  });

  // Aynı yıldan modeller (skor: 50)
  sameYearModels.forEach((m) => {
    if (!similarModels.find((sm) => sm.id === m.id)) {
      similarModels.push({
        ...m,
        similarityScore: 50,
      });
    }
  });

  // Skora göre sırala ve limit'e göre kes
  return similarModels
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

/**
 * Belirli bir SubSeries'te eksik modelleri bulur
 */
export async function getMissingModelsInSubSeries(
  subSeriesId: number
): Promise<MissingModel[]> {
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

  // Bu SubSeries'teki tüm modelleri bul
  const allModels = await prisma.model.findMany({
    where: {
      subSeriesId: subSeriesId,
    },
    include: {
      variants: {
        include: {
          images: {
            take: 1,
          },
        },
      },
    },
  });

  // Owned=false olan modelleri filtrele
  const missingModels = allModels.filter((model) => !model.owned);

  return missingModels.map((model) => ({
    id: model.id,
    castingName: model.castingName,
    castingId: model.castingId,
    subSeries: {
      name: subSeries.name,
      collection: {
        name: subSeries.collection.name,
        year: {
          year: subSeries.collection.year.year,
        },
      },
    },
    variants: model.variants.map((v) => ({
      id: v.id,
      year: v.year,
      color: v.color,
      images: v.images.map((img) => ({ path: img.path })),
    })),
  }));
}

/**
 * Belirli bir Collection'da eksik modelleri bulur
 */
export async function getMissingModelsInCollection(
  collectionId: number
): Promise<MissingModel[]> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      year: true,
    },
  });

  if (!collection) {
    return [];
  }

  // Bu Collection'daki tüm modelleri bul
  const allModels = await prisma.model.findMany({
    where: {
      collectionId: collectionId,
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
          images: {
            take: 1,
          },
        },
      },
    },
  });

  // Owned=false olan modelleri filtrele
  const missingModels = allModels.filter((model) => !model.owned);

  return missingModels.map((model) => ({
    id: model.id,
    castingName: model.castingName,
    castingId: model.castingId,
    subSeries: model.subSeries
      ? {
          name: model.subSeries.name,
          collection: {
            name: collection.name,
            year: {
              year: collection.year.year,
            },
          },
        }
      : null,
    variants: model.variants.map((v) => ({
      id: v.id,
      year: v.year,
      color: v.color,
      images: v.images.map((img) => ({ path: img.path })),
    })),
  }));
}

/**
 * Tamamlanma önerileri - hangi serilerin tamamlanmaya yakın olduğunu bulur
 */
export async function getCompletionSuggestions(
  minCompletionPercentage: number = 50,
  limit: number = 10
): Promise<CompletionSuggestion[]> {
  // Tüm SubSeries'leri al
  const allSubSeries = await prisma.subSeries.findMany({
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      models: {
        include: {
          variants: {
            include: {
              images: {
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const suggestions: CompletionSuggestion[] = [];

  for (const subSeries of allSubSeries) {
    const totalModels = subSeries.models.length;
    if (totalModels === 0) continue;

    const ownedModels = subSeries.models.filter((m) => m.owned).length;
    const completionPercentage = (ownedModels / totalModels) * 100;

    // Minimum tamamlanma yüzdesini geçen ve %100'den az olan seriler
    if (
      completionPercentage >= minCompletionPercentage &&
      completionPercentage < 100
    ) {
      const missingModels = subSeries.models
        .filter((m) => !m.owned)
        .map((model) => ({
          id: model.id,
          castingName: model.castingName,
          castingId: model.castingId,
          subSeries: {
            name: subSeries.name,
            collection: {
              name: subSeries.collection.name,
              year: {
                year: subSeries.collection.year.year,
              },
            },
          },
          variants: model.variants.map((v) => ({
            id: v.id,
            year: v.year,
            color: v.color,
            images: v.images.map((img) => ({ path: img.path })),
          })),
        }));

      suggestions.push({
        subSeriesId: subSeries.id,
        subSeriesName: subSeries.name,
        collectionName: subSeries.collection.name,
        year: subSeries.collection.year.year,
        totalModels,
        ownedModels,
        missingModels: totalModels - ownedModels,
        completionPercentage,
        missingModelList: missingModels,
      });
    }
  }

  // Tamamlanma yüzdesine göre sırala (yüksekten düşüğe)
  return suggestions
    .sort((a, b) => b.completionPercentage - a.completionPercentage)
    .slice(0, limit);
}

/**
 * Son 30 günde eklenen modelleri bulur
 */
export async function getRecentlyAddedModels(
  days: number = 30,
  limit: number = 20
): Promise<SimilarModel[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Not: Prisma schema'da createdAt field'ı yok, bu yüzden şimdilik tüm modelleri döndürüyoruz
  // İleride Activity tablosu eklendiğinde bu fonksiyon güncellenebilir
  const models = await prisma.model.findMany({
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
          images: {
            take: 1,
          },
        },
      },
    },
    orderBy: {
      id: 'desc',
    },
    take: limit,
  });

  return models.map((model) => ({
    ...model,
    similarityScore: 0, // Yeni eklenen modeller için skor yok
  }));
}




