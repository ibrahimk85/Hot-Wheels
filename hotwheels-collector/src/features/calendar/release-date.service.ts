import prisma from '@/db';

export interface ReleaseDateData {
  id: number;
  collectionId: number | null;
  subSeriesId: number | null;
  modelId: number | null;
  releaseDate: Date;
  region: string | null;
  source: string;
  confirmed: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Release date oluştur
 */
export async function createReleaseDate(data: {
  collectionId?: number;
  subSeriesId?: number;
  modelId?: number;
  releaseDate: Date;
  region?: string;
  source?: string;
  confirmed?: boolean;
  notes?: string;
}): Promise<ReleaseDateData> {
  const releaseDate = await prisma.releaseDate.create({
    data: {
      collectionId: data.collectionId || null,
      subSeriesId: data.subSeriesId || null,
      modelId: data.modelId || null,
      releaseDate: data.releaseDate,
      region: data.region || null,
      source: data.source || 'manual',
      confirmed: data.confirmed || false,
      notes: data.notes || null,
    },
  });

  return releaseDate as ReleaseDateData;
}

/**
 * Release date'leri getir
 */
export async function getReleaseDates(filters?: {
  collectionId?: number;
  subSeriesId?: number;
  modelId?: number;
  region?: string;
  confirmed?: boolean;
  startDate?: Date;
  endDate?: Date;
}): Promise<ReleaseDateData[]> {
  const where: any = {};

  if (filters?.collectionId) {
    where.collectionId = filters.collectionId;
  }

  if (filters?.subSeriesId) {
    where.subSeriesId = filters.subSeriesId;
  }

  if (filters?.modelId) {
    where.modelId = filters.modelId;
  }

  if (filters?.region) {
    where.region = filters.region;
  }

  if (filters?.confirmed !== undefined) {
    where.confirmed = filters.confirmed;
  }

  if (filters?.startDate || filters?.endDate) {
    where.releaseDate = {};
    if (filters.startDate) {
      where.releaseDate.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.releaseDate.lte = filters.endDate;
    }
  }

  try {
    const releaseDates = await prisma.releaseDate.findMany({
      where,
      orderBy: {
        releaseDate: 'asc',
      },
      include: {
        collection: {
          include: {
            year: true,
          },
        },
        subSeries: true,
        model: true,
      },
    });

    return releaseDates.map((rd) => ({
      id: rd.id,
      collectionId: rd.collectionId,
      subSeriesId: rd.subSeriesId,
      modelId: rd.modelId,
      releaseDate: rd.releaseDate,
      region: rd.region,
      source: rd.source,
      confirmed: rd.confirmed,
      notes: rd.notes,
      createdAt: rd.createdAt,
      updatedAt: rd.updatedAt,
      collection: rd.collection ? {
        name: rd.collection.name,
        year: rd.collection.year,
      } : undefined,
      subSeries: rd.subSeries ? {
        name: rd.subSeries.name,
      } : undefined,
      model: rd.model ? {
        castingName: rd.model.castingName,
      } : undefined,
    })) as any[];
  } catch (error: any) {
    console.error('Prisma error in getReleaseDates:', error);
    throw error;
  }
}

/**
 * Release date güncelle
 */
export async function updateReleaseDate(
  id: number,
  data: {
    releaseDate?: Date;
    region?: string;
    source?: string;
    confirmed?: boolean;
    notes?: string;
  }
): Promise<ReleaseDateData> {
  const releaseDate = await prisma.releaseDate.update({
    where: { id },
    data: {
      releaseDate: data.releaseDate,
      region: data.region,
      source: data.source,
      confirmed: data.confirmed,
      notes: data.notes,
    },
  });

  return releaseDate as ReleaseDateData;
}

/**
 * Release date sil
 */
export async function deleteReleaseDate(id: number): Promise<void> {
  await prisma.releaseDate.delete({
    where: { id },
  });
}

/**
 * Yaklaşan release date'leri getir
 */
export async function getUpcomingReleases(days: number = 30): Promise<ReleaseDateData[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return getReleaseDates({
    startDate: today,
    endDate: futureDate,
  });
}
