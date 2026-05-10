import prisma from '@/db';

export type GoalType =
  | 'model_count'
  | 'collection_complete'
  | 'value_target'
  | 'year_target';

export interface GoalData {
  id: number;
  name: string;
  description: string | null;
  targetCount: number;
  currentCount: number;
  type: string;
  targetId: number | null;
  userId: number | null;
  deadline: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tüm hedefleri getirir
 */
export async function getAllGoals(): Promise<GoalData[]> {
  return prisma.goal.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Belirli bir hedefi getirir
 */
export async function getGoalById(id: number): Promise<GoalData | null> {
  return prisma.goal.findUnique({
    where: { id },
  });
}

/**
 * Yeni hedef oluşturur
 */
export async function createGoal(data: {
  name: string;
  description?: string;
  targetCount: number;
  userId?: number;
  type: GoalType;
  targetId?: number;
  deadline?: Date;
}): Promise<GoalData> {
  return prisma.goal.create({
    data: {
      name: data.name,
      description: data.description || null,
      targetCount: data.targetCount,
      currentCount: 0,
      type: data.type,
      targetId: data.targetId || null,
      deadline: data.deadline || null,
      completed: false,
      userId: data.userId || null,
    },
  });
}

/**
 * Hedefi günceller
 */
export async function updateGoal(
  id: number,
  data: {
    name?: string;
    description?: string;
    targetCount?: number;
    deadline?: Date;
  }
): Promise<GoalData> {
  return prisma.goal.update({
    where: { id },
    data,
  });
}

/**
 * Hedefi siler
 */
export async function deleteGoal(id: number): Promise<boolean> {
  try {
    await prisma.goal.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Error deleting goal:', error);
    return false;
  }
}

/**
 * Hedefin ilerlemesini hesaplar ve günceller
 */
export async function updateGoalProgress(id: number): Promise<GoalData | null> {
  const goal = await prisma.goal.findUnique({
    where: { id },
  });

  if (!goal) {
    return null;
  }

  let currentCount = 0;

  switch (goal.type) {
    case 'model_count':
      // Toplam owned model sayısı
      currentCount = await prisma.model.count({
        where: { owned: true },
      });
      break;

    case 'collection_complete':
      // Belirli bir collection'daki owned model sayısı
      if (goal.targetId) {
        currentCount = await prisma.model.count({
          where: {
            collectionId: goal.targetId,
            owned: true,
          },
        });
      }
      break;

    case 'value_target':
      // Toplam koleksiyon değeri (packed + loose)
      const models = await prisma.model.findMany({
        where: { owned: true },
        select: {
          packedPrice: true,
          loosePrice: true,
        },
      });
      currentCount = Math.round(
        models.reduce((sum, model) => {
          const packed = model.packedPrice || 0;
          const loose = model.loosePrice || 0;
          return sum + Math.max(packed, loose);
        }, 0)
      );
      break;

    case 'year_target':
      // Belirli bir yıldaki owned model sayısı
      if (goal.targetId) {
        const year = await prisma.year.findUnique({
          where: { id: goal.targetId },
        });
        if (year) {
          currentCount = await prisma.model.count({
            where: {
              owned: true,
              collection: {
                yearId: year.id,
              },
            },
          });
        }
      }
      break;
  }

  const completed = currentCount >= goal.targetCount;
  const completedAt = completed && !goal.completed ? new Date() : goal.completedAt;

  return prisma.goal.update({
    where: { id },
    data: {
      currentCount,
      completed,
      completedAt,
    },
  });
}

/**
 * Tüm hedeflerin ilerlemesini günceller
 */
export async function updateAllGoalsProgress(): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { completed: false },
  });

  for (const goal of goals) {
    await updateGoalProgress(goal.id);
  }
}

/**
 * Deadline yaklaşan hedefleri getirir (7 gün içinde)
 */
export async function getUpcomingDeadlines(): Promise<GoalData[]> {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return prisma.goal.findMany({
    where: {
      completed: false,
      deadline: {
        not: null,
        lte: sevenDaysFromNow,
        gte: new Date(),
      },
    },
    orderBy: {
      deadline: 'asc',
    },
  });
}


