import { NextRequest, NextResponse } from 'next/server';
import {
  createDailyQuest,
  getTodayDailyQuests,
  getUserDailyQuestProgress,
} from '@/features/gamification/daily-quest.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    const quests = await getTodayDailyQuests();

    // Kullanıcı ilerlemesini ekle
    if (userId) {
      const questsWithProgress = await Promise.all(
        quests.map(async (quest) => {
          const progress = await getUserDailyQuestProgress(
            parseInt(userId),
            quest.id
          );
          return {
            ...quest,
            progress: progress?.progress || 0,
            completed: progress?.completed || false,
          };
        })
      );
      return NextResponse.json(questsWithProgress);
    }

    return NextResponse.json(quests);
  } catch (error: any) {
    console.error('Error fetching daily quests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily quests', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const quest = await createDailyQuest({
      name: body.name,
      description: body.description,
      type: body.type,
      targetValue: body.targetValue,
      xpReward: body.xpReward,
      reward: body.reward,
      questDate: body.questDate ? new Date(body.questDate) : undefined,
      active: body.active !== undefined ? body.active : true,
    });

    return NextResponse.json(quest);
  } catch (error: any) {
    console.error('Error creating daily quest:', error);
    return NextResponse.json(
      { error: 'Failed to create daily quest', details: error.message },
      { status: 500 }
    );
  }
}



