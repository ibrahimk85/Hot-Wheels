import { NextResponse } from 'next/server';
import { getOverallCompletion } from '@/features/analytics/completion.service';

export async function GET() {
  try {
    const completion = await getOverallCompletion();
    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error fetching overall completion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overall completion' },
      { status: 500 }
    );
  }
}



