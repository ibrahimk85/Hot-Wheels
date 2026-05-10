import { NextResponse } from 'next/server';
import { checkAndUnlockAchievements, updateStreak } from '@/features/gamification/achievement.service';

export async function POST() {
  try {
    // Achievement'ları kontrol et
    const unlockedIds = await checkAndUnlockAchievements();
    
    // Streak güncelle
    const streak = await updateStreak();

    return NextResponse.json({
      unlockedIds,
      streak,
      message: 'Achievements checked successfully',
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    return NextResponse.json(
      { error: 'Failed to check achievements' },
      { status: 500 }
    );
  }
}




