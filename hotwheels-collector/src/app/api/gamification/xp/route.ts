import { NextRequest, NextResponse } from 'next/server';
import { getUserXP, addXP } from '@/features/gamification/xp-level.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const userXP = await getUserXP(parseInt(userId));
    return NextResponse.json(userXP);
  } catch (error: any) {
    console.error('Error fetching user XP:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user XP', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, xp } = body;

    if (!userId || !xp) {
      return NextResponse.json(
        { error: 'userId and xp are required' },
        { status: 400 }
      );
    }

    const userXP = await addXP(parseInt(userId), parseInt(xp));
    return NextResponse.json(userXP);
  } catch (error: any) {
    console.error('Error adding XP:', error);
    return NextResponse.json(
      { error: 'Failed to add XP', details: error.message },
      { status: 500 }
    );
  }
}



