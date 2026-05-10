import { NextRequest, NextResponse } from 'next/server';
import {
  getAllGoals,
  createGoal,
  updateGoalProgress,
} from '@/features/goals/goal.service';
import { apiHandler } from '@/lib/api-handler';
import { withAuth } from '@/lib/auth';

export const GET = apiHandler(
  withAuth(async (user, request) => {
    // Get user-specific goals
    const goals = await getAllGoals();
    const userGoals = goals.filter((goal) => goal.userId === user.id || goal.userId === null);
    
    // Tüm hedeflerin ilerlemesini güncelle
    await Promise.all(userGoals.map((goal) => updateGoalProgress(goal.id)));

    // Güncellenmiş hedefleri tekrar getir
    const updatedGoals = await getAllGoals();
    const updatedUserGoals = updatedGoals.filter((goal) => goal.userId === user.id || goal.userId === null);
    
    return NextResponse.json(updatedUserGoals);
  })
);

export const POST = apiHandler(
  withAuth(async (user, request) => {
    const body = await request.json();
    const { name, description, targetCount, type, targetId, deadline } = body;

    if (!name || !targetCount || !type) {
      throw new Error('name, targetCount, and type are required');
    }

    const goal = await createGoal({
      name,
      description,
      targetCount: Number(targetCount),
      type: type as any,
      targetId: targetId ? Number(targetId) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      userId: user.id,
    });

    // İlerlemeyi hesapla
    const updatedGoal = await updateGoalProgress(goal.id);

    return NextResponse.json(updatedGoal || goal);
  })
);

