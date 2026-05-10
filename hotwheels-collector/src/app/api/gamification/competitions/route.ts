import { NextRequest, NextResponse } from 'next/server';
import {
  createCompetition,
  getActiveCompetitions,
} from '@/features/gamification/competition.service';

export async function GET() {
  try {
    const competitions = await getActiveCompetitions();
    return NextResponse.json(competitions);
  } catch (error: any) {
    console.error('Error fetching competitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitions', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const competition = await createCompetition({
      userId: body.userId,
      name: body.name,
      description: body.description,
      type: body.type,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      rules: body.rules,
      prizes: body.prizes,
      active: body.active !== undefined ? body.active : true,
    });

    return NextResponse.json(competition);
  } catch (error: any) {
    console.error('Error creating competition:', error);
    return NextResponse.json(
      { error: 'Failed to create competition', details: error.message },
      { status: 500 }
    );
  }
}



