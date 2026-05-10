import prisma from '@/db';

export interface UserXPData {
  id: number;
  userId: number;
  totalXP: number;
  currentLevel: number;
  levelXP: number;
  nextLevelXP: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Kullanıcı XP'sini getir veya oluştur
 */
export async function getUserXP(userId: number): Promise<UserXPData> {
  let userXP = await prisma.userXP.findUnique({
    where: { userId },
  });

  if (!userXP) {
    userXP = await prisma.userXP.create({
      data: {
        userId,
        totalXP: 0,
        currentLevel: 1,
        levelXP: 0,
        nextLevelXP: 100,
      },
    });
  }

  return userXP as UserXPData;
}

/**
 * XP ekle
 */
export async function addXP(
  userId: number,
  xp: number
): Promise<UserXPData> {
  const userXP = await getUserXP(userId);

  const updated = await prisma.userXP.update({
    where: { userId },
    data: {
      totalXP: { increment: xp },
      levelXP: { increment: xp },
    },
  });

  // Level up kontrolü
  await checkLevelUp(userId, updated);

  return updated as UserXPData;
}

/**
 * Level up kontrolü
 */
async function checkLevelUp(
  userId: number,
  userXP: UserXPData
): Promise<void> {
  let currentXP = userXP;
  let leveledUp = false;

  while (currentXP.levelXP >= currentXP.nextLevelXP) {
    const remainingXP = currentXP.levelXP - currentXP.nextLevelXP;
    const newLevel = currentXP.currentLevel + 1;

    currentXP = await prisma.userXP.update({
      where: { userId },
      data: {
        currentLevel: newLevel,
        levelXP: remainingXP,
        nextLevelXP: calculateNextLevelXP(newLevel),
      },
    });

    leveledUp = true;
  }

  if (leveledUp) {
    // Level up notification veya achievement kontrolü burada yapılabilir
    console.log(`User ${userId} leveled up to ${currentXP.currentLevel}`);
  }
}

/**
 * Bir sonraki seviye için gereken XP'yi hesapla
 */
function calculateNextLevelXP(level: number): number {
  // Exponential leveling: Her seviye için %20 daha fazla XP
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

/**
 * Level progress yüzdesini hesapla
 */
export function calculateLevelProgress(userXP: UserXPData): number {
  if (userXP.nextLevelXP === 0) return 100;
  return Math.min(100, (userXP.levelXP / userXP.nextLevelXP) * 100);
}



