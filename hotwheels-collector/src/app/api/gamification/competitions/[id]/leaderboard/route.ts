import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionLeaderboard } from '@/features/gamification/competition.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const competitionId = parseInt(id);
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const leaderboard = await getCompetitionLeaderboard(competitionId, limit);
    return NextResponse.json(leaderboard);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', details: error.message },
      { status: 500 }
    );
  }
}



