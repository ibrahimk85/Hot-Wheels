import prisma from '@/db';

export interface AchievementCondition {
  type: 'model_count' | 'variant_count' | 'treasure_hunt' | 'super_treasure_hunt' | 'collection_complete' | 'streak_days';
  value: number;
  operator?: 'gte' | 'eq' | 'lte';
}

export interface AchievementData {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  rarity: string;
  condition: AchievementCondition;
  unlocked: boolean;
  progress: number;
  progressMax: number;
  unlockedAt: Date | null;
}

/**
 * Tüm achievement'ları getir
 */
export async function getAllAchievements(): Promise<AchievementData[]> {
  const achievements = await prisma.achievement.findMany({
    orderBy: {
      rarity: 'asc',
    },
  });

  // Kullanıcının achievement'larını kontrol et (şimdilik tek kullanıcı için userId = null)
  const userAchievements = await prisma.userAchievement.findMany({
    where: {
      userId: null,
    },
  });

  const userAchievementMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua])
  );

  // Her achievement için progress hesapla
  const achievementData: AchievementData[] = await Promise.all(
    achievements.map(async (achievement) => {
      const userAchievement = userAchievementMap.get(achievement.id);
      const condition: AchievementCondition = JSON.parse(achievement.condition);
      const progress = await calculateProgress(condition);
      const progressMax = condition.value;

      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        rarity: achievement.rarity,
        condition,
        unlocked: userAchievement?.completed || false,
        progress: Math.min(progress, progressMax),
        progressMax,
        unlockedAt: userAchievement?.unlockedAt || null,
      };
    })
  );

  return achievementData;
}

/**
 * Achievement progress hesapla
 */
async function calculateProgress(condition: AchievementCondition): Promise<number> {
  switch (condition.type) {
    case 'model_count':
      return prisma.model.count({
        where: { owned: true },
      });

    case 'variant_count':
      return prisma.variant.count({
        where: { owned: true },
      });

    case 'treasure_hunt':
      return prisma.variant.count({
        where: {
          owned: true,
          isTreasureHunt: true,
        },
      });

    case 'super_treasure_hunt':
      return prisma.variant.count({
        where: {
          owned: true,
          isSuperTreasureHunt: true,
        },
      });

    case 'collection_complete':
      // Belirli bir koleksiyonun tamamlanma yüzdesi
      const collection = await prisma.collection.findUnique({
        where: { id: condition.value },
        include: {
          models: true,
        },
      });
      if (!collection) return 0;
      const ownedCount = collection.models.filter((m) => m.owned).length;
      return Math.round((ownedCount / collection.models.length) * 100);

    case 'streak_days':
      const streak = await prisma.streak.findFirst({
        where: { userId: null },
      });
      return streak?.currentDays || 0;

    default:
      return 0;
  }
}

/**
 * Achievement'ları kontrol et ve unlock et
 */
export async function checkAndUnlockAchievements(): Promise<number[]> {
  const achievements = await prisma.achievement.findMany();
  const unlockedIds: number[] = [];

  for (const achievement of achievements) {
    const condition: AchievementCondition = JSON.parse(achievement.condition);
    const progress = await calculateProgress(condition);
    const operator = condition.operator || 'gte';

    let shouldUnlock = false;
    if (operator === 'gte') {
      shouldUnlock = progress >= condition.value;
    } else if (operator === 'eq') {
      shouldUnlock = progress === condition.value;
    } else if (operator === 'lte') {
      shouldUnlock = progress <= condition.value;
    }

    if (shouldUnlock) {
      // Kullanıcı achievement'ı var mı kontrol et
      const existing = await prisma.userAchievement.findFirst({
        where: {
          achievementId: achievement.id,
          userId: null,
        },
      });

      if (!existing) {
        // Yeni achievement unlock et
        await prisma.userAchievement.create({
          data: {
            achievementId: achievement.id,
            userId: null,
            progress,
            completed: true,
          },
        });
        unlockedIds.push(achievement.id);
      } else if (!existing.completed) {
        // Mevcut achievement'ı tamamla
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: {
            completed: true,
            progress,
          },
        });
        unlockedIds.push(achievement.id);
      } else {
        // Progress güncelle
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: { progress },
        });
      }
    } else {
      // Progress güncelle (unlock olmasa bile)
      const existing = await prisma.userAchievement.findFirst({
        where: {
          achievementId: achievement.id,
          userId: null,
        },
      });

      if (existing) {
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: { progress },
        });
      } else {
        // İlk kez progress kaydet
        await prisma.userAchievement.create({
          data: {
            achievementId: achievement.id,
            userId: null,
            progress,
            completed: false,
          },
        });
      }
    }
  }

  return unlockedIds;
}

/**
 * Streak güncelle
 */
export async function updateStreak(): Promise<{ currentDays: number; longestDays: number }> {
  let streak = await prisma.streak.findFirst({
    where: { userId: null },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!streak) {
    streak = await prisma.streak.create({
      data: {
        userId: null,
        currentDays: 1,
        longestDays: 1,
        lastLogin: today,
      },
    });
    return { currentDays: 1, longestDays: 1 };
  }

  const lastLogin = new Date(streak.lastLogin);
  lastLogin.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    // Bugün zaten giriş yapılmış
    return { currentDays: streak.currentDays, longestDays: streak.longestDays };
  } else if (daysDiff === 1) {
    // Dün giriş yapılmış, streak devam ediyor
    const newCurrentDays = streak.currentDays + 1;
    const newLongestDays = Math.max(streak.longestDays, newCurrentDays);

    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentDays: newCurrentDays,
        longestDays: newLongestDays,
        lastLogin: today,
      },
    });

    return { currentDays: newCurrentDays, longestDays: newLongestDays };
  } else {
    // Streak kırıldı, sıfırla
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentDays: 1,
        lastLogin: today,
      },
    });

    return { currentDays: 1, longestDays: streak.longestDays };
  }
}

/**
 * Leaderboard verileri
 */
export async function getLeaderboard() {
  // En çok model
  const topModels = await prisma.model.findMany({
    where: { owned: true },
    take: 10,
    orderBy: { id: 'desc' },
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
    },
  });

  // En çok varyant
  const topVariants = await prisma.variant.findMany({
    where: { owned: true },
    take: 10,
    orderBy: { id: 'desc' },
    include: {
      model: {
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
        },
      },
    },
  });

  // En değerli koleksiyon
  const models = await prisma.model.findMany({
    where: { owned: true },
    select: {
      packedPrice: true,
      loosePrice: true,
      subSeries: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
    },
  });

  const collectionValueMap = new Map<string, { value: number; count: number }>();
  models.forEach((m) => {
    const value = Math.max(m.packedPrice || 0, m.loosePrice || 0);
    const collectionName = m.subSeries?.collection.name || 'Unknown';
    const year = m.subSeries?.collection.year.year || 0;
    const key = `${collectionName}-${year}`;

    if (!collectionValueMap.has(key)) {
      collectionValueMap.set(key, { value: 0, count: 0 });
    }
    const existing = collectionValueMap.get(key)!;
    existing.value += value;
    existing.count += 1;
  });

  const topCollections = Array.from(collectionValueMap.entries())
    .map(([key, data]) => {
      const [name, yearStr] = key.split('-');
      return {
        name,
        year: Number(yearStr),
        value: data.value,
        count: data.count,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    topModels: topModels.length,
    topVariants: topVariants.length,
    topCollections,
  };
}

/**
 * İlk achievement'ları seed et
 */
export async function seedAchievements() {
  const achievements = [
    {
      name: 'İlk Model',
      description: 'İlk modelini koleksiyonuna ekle',
      icon: '🎯',
      condition: JSON.stringify({ type: 'model_count', value: 1, operator: 'gte' } as AchievementCondition),
      rarity: 'common',
    },
    {
      name: 'Koleksiyoncu',
      description: '10 model topla',
      icon: '🏆',
      condition: JSON.stringify({ type: 'model_count', value: 10, operator: 'gte' } as AchievementCondition),
      rarity: 'common',
    },
    {
      name: 'Uzman',
      description: '100 model topla',
      icon: '⭐',
      condition: JSON.stringify({ type: 'model_count', value: 100, operator: 'gte' } as AchievementCondition),
      rarity: 'rare',
    },
    {
      name: 'Efsane',
      description: '1000 model topla',
      icon: '👑',
      condition: JSON.stringify({ type: 'model_count', value: 1000, operator: 'gte' } as AchievementCondition),
      rarity: 'legendary',
    },
    {
      name: 'Varyant Avcısı',
      description: '50 varyant topla',
      icon: '🔍',
      condition: JSON.stringify({ type: 'variant_count', value: 50, operator: 'gte' } as AchievementCondition),
      rarity: 'common',
    },
    {
      name: 'Hazine Avcısı',
      description: 'İlk Treasure Hunt\'ı bul',
      icon: '💎',
      condition: JSON.stringify({ type: 'treasure_hunt', value: 1, operator: 'gte' } as AchievementCondition),
      rarity: 'rare',
    },
    {
      name: 'Altın El',
      description: 'İlk Super Treasure Hunt\'ı bul',
      icon: '✨',
      condition: JSON.stringify({ type: 'super_treasure_hunt', value: 1, operator: 'gte' } as AchievementCondition),
      rarity: 'epic',
    },
    {
      name: 'Günlük Ziyaretçi',
      description: '7 gün üst üste giriş yap',
      icon: '🔥',
      condition: JSON.stringify({ type: 'streak_days', value: 7, operator: 'gte' } as AchievementCondition),
      rarity: 'common',
    },
    {
      name: 'Ateşli',
      description: '30 gün üst üste giriş yap',
      icon: '🔥🔥',
      condition: JSON.stringify({ type: 'streak_days', value: 30, operator: 'gte' } as AchievementCondition),
      rarity: 'rare',
    },
  ];

  for (const achievement of achievements) {
    const existing = await prisma.achievement.findFirst({
      where: { name: achievement.name },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: achievement,
      });
    } else {
      await prisma.achievement.create({
        data: achievement,
      });
    }
  }
}

