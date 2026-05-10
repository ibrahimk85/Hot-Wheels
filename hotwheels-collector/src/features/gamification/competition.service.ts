import prisma from '@/db';

export interface CompetitionData {
  id: number;
  userId: number | null;
  name: string;
  description: string | null;
  type: string;
  startDate: Date;
  endDate: Date;
  rules: string | null;
  prizes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitionEntryData {
  id: number;
  userId: number | null;
  competitionId: number;
  score: number;
  rank: number | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Competition oluştur
 */
export async function createCompetition(data: {
  userId?: number;
  name: string;
  description?: string;
  type: string;
  startDate: Date;
  endDate: Date;
  rules?: string;
  prizes?: string;
  active?: boolean;
}): Promise<CompetitionData> {
  const competition = await prisma.competition.create({
    data: {
      userId: data.userId || null,
      name: data.name,
      description: data.description || null,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      rules: data.rules || null,
      prizes: data.prizes || null,
      active: data.active !== undefined ? data.active : true,
    },
  });

  return competition as CompetitionData;
}

/**
 * Aktif competition'ları getir
 */
export async function getActiveCompetitions(): Promise<CompetitionData[]> {
  const now = new Date();
  const competitions = await prisma.competition.findMany({
    where: {
      active: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  return competitions as CompetitionData[];
}

/**
 * Competition'a katılım
 */
export async function enterCompetition(
  userId: number | null,
  competitionId: number,
  score: number
): Promise<CompetitionEntryData> {
  const entry = await prisma.competitionEntry.create({
    data: {
      userId: userId || null,
      competitionId,
      score,
    },
  });

  // Sıralamayı güncelle
  await updateCompetitionRankings(competitionId);

  return entry as CompetitionEntryData;
}

/**
 * Competition sıralamasını güncelle
 */
export async function updateCompetitionRankings(
  competitionId: number
): Promise<void> {
  const entries = await prisma.competitionEntry.findMany({
    where: { competitionId },
    orderBy: { score: 'desc' },
  });

  for (let i = 0; i < entries.length; i++) {
    await prisma.competitionEntry.update({
      where: { id: entries[i].id },
      data: { rank: i + 1 },
    });
  }
}

/**
 * Competition leaderboard'u getir
 */
export async function getCompetitionLeaderboard(
  competitionId: number,
  limit: number = 10
): Promise<CompetitionEntryData[]> {
  const entries = await prisma.competitionEntry.findMany({
    where: { competitionId },
    orderBy: { score: 'desc' },
    take: limit,
  });

  return entries as CompetitionEntryData[];
}



