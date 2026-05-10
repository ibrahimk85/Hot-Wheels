import { NextRequest, NextResponse } from 'next/server';
import {
  getGoalById,
  updateGoal,
  deleteGoal,
  updateGoalProgress,
} from '@/features/goals/goal.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const goal = await getGoalById(Number(id));

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // İlerlemeyi güncelle
    const updatedGoal = await updateGoalProgress(goal.id);

    return NextResponse.json(updatedGoal || goal);
  } catch (error) {
    console.error('Error fetching goal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goal' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, targetCount, deadline } = body;

    const goal = await updateGoal(Number(id), {
      name,
      description,
      targetCount: targetCount ? Number(targetCount) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    // İlerlemeyi güncelle
    const updatedGoal = await updateGoalProgress(goal.id);

    return NextResponse.json(updatedGoal || goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteGoal(Number(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete goal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}




