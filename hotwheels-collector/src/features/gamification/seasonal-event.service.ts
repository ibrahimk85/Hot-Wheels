import prisma from '@/db';

export interface SeasonalEventData {
  id: number;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  type: string;
  rewards: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seasonal event oluştur
 */
export async function createSeasonalEvent(data: {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  type: string;
  rewards?: string;
  active?: boolean;
}): Promise<SeasonalEventData> {
  const event = await prisma.seasonalEvent.create({
    data: {
      name: data.name,
      description: data.description || null,
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type,
      rewards: data.rewards || null,
      active: data.active !== undefined ? data.active : true,
    },
  });

  return event as SeasonalEventData;
}

/**
 * Aktif seasonal event'leri getir
 */
export async function getActiveSeasonalEvents(): Promise<SeasonalEventData[]> {
  const now = new Date();
  const events = await prisma.seasonalEvent.findMany({
    where: {
      active: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  return events as SeasonalEventData[];
}

/**
 * Seasonal event'e katılım
 */
export async function joinSeasonalEvent(
  userId: number | null,
  eventId: number
): Promise<void> {
  const existing = await prisma.seasonalEventParticipant.findFirst({
    where: {
      userId: userId || null,
      eventId,
    },
  });

  if (existing) {
    return;
  }

  await prisma.seasonalEventParticipant.create({
    data: {
      userId: userId || null,
      eventId,
      progress: 0,
      completed: false,
    },
  });
}

/**
 * Seasonal event ilerlemesini güncelle
 */
export async function updateSeasonalEventProgress(
  userId: number | null,
  eventId: number,
  progress: number
): Promise<void> {
  const participant = await prisma.seasonalEventParticipant.findFirst({
    where: {
      userId: userId || null,
      eventId,
    },
  });

  if (participant) {
    await prisma.seasonalEventParticipant.update({
      where: { id: participant.id },
      data: {
        progress,
        completed: progress >= 100,
        completedAt: progress >= 100 ? new Date() : null,
      },
    });
  }
}

