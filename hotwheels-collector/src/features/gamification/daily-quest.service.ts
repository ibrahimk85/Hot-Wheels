import prisma from '@/db';

export interface DailyQuestData {
  id: number;
  name: string;
  description: string | null;
  type: string;
  targetValue: number;
  xpReward: number;
  reward: string | null;
  active: boolean;
  questDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyQuestCompletionData {
  id: number;
  userId: number | null;
  questId: number;
  progress: number;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Daily quest oluştur
 */
export async function createDailyQuest(data: {
  name: string;
  description?: string;
  type: string;
  targetValue: number;
  xpReward?: number;
  reward?: string;
  questDate?: Date;
  active?: boolean;
}): Promise<DailyQuestData> {
  const quest = await prisma.dailyQuest.create({
    data: {
      name: data.name,
      description: data.description || null,
      type: data.type,
      targetValue: data.targetValue,
      xpReward: data.xpReward || 10,
      reward: data.reward || null,
      questDate: data.questDate || new Date(),
      active: data.active !== undefined ? data.active : true,
    },
  });

  return quest as DailyQuestData;
}

/**
 * Bugünün daily quest'lerini getir
 */
export async function getTodayDailyQuests(): Promise<DailyQuestData[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const quests = await prisma.dailyQuest.findMany({
    where: {
      active: true,
      questDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return quests as DailyQuestData[];
}

/**
 * Kullanıcının daily quest ilerlemesini getir
 */
export async function getUserDailyQuestProgress(
  userId: number | null,
  questId: number
): Promise<DailyQuestCompletionData | null> {
  const completion = await prisma.dailyQuestCompletion.findFirst({
    where: {
      userId: userId || null,
      questId,
    },
  });

  return completion as DailyQuestCompletionData | null;
}

/**
 * Daily quest ilerlemesini güncelle
 */
export async function updateDailyQuestProgress(
  userId: number | null,
  questId: number,
  progress: number
): Promise<DailyQuestCompletionData> {
  const quest = await prisma.dailyQuest.findUnique({
    where: { id: questId },
  });

  if (!quest) {
    throw new Error('Quest not found');
  }

  const existing = await prisma.dailyQuestCompletion.findFirst({
    where: {
      userId: userId || null,
      questId,
    },
  });

  const completion = existing
    ? await prisma.dailyQuestCompletion.update({
        where: { id: existing.id },
        data: {
          progress,
          completed: progress >= quest.targetValue,
          completedAt: progress >= quest.targetValue ? new Date() : null,
        },
      })
    : await prisma.dailyQuestCompletion.create({
        data: {
          userId: userId || null,
          questId,
          progress,
          completed: progress >= quest.targetValue,
          completedAt: progress >= quest.targetValue ? new Date() : null,
        },
      });

  // Quest tamamlandıysa XP ver
  if (completion.completed && !completion.completedAt) {
    await awardXP(userId, quest.xpReward);
  }

  return completion as DailyQuestCompletionData;
}

/**
 * XP ver
 */
async function awardXP(userId: number | null, xp: number): Promise<void> {
  if (!userId) return;

  const userXP = await prisma.userXP.upsert({
    where: { userId },
    create: {
      userId,
      totalXP: xp,
      currentLevel: 1,
      levelXP: xp,
      nextLevelXP: 100,
    },
    update: {
      totalXP: { increment: xp },
      levelXP: { increment: xp },
    },
  });

  // Level up kontrolü
  while (userXP.levelXP >= userXP.nextLevelXP) {
    const remainingXP = userXP.levelXP - userXP.nextLevelXP;
    await prisma.userXP.update({
      where: { userId },
      data: {
        currentLevel: { increment: 1 },
        levelXP: remainingXP,
        nextLevelXP: calculateNextLevelXP(userXP.currentLevel + 1),
      },
    });
  }
}

/**
 * Bir sonraki seviye için gereken XP'yi hesapla
 */
function calculateNextLevelXP(level: number): number {
  // Exponential leveling: Her seviye için %20 daha fazla XP
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

