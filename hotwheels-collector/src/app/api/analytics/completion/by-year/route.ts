import { NextResponse } from 'next/server';
import { getCompletionByYear } from '@/features/analytics/completion.service';

export async function GET() {
  try {
    const completion = await getCompletionByYear();
    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error fetching completion by year:', error);
    return NextResponse.json(
      { error: 'Failed to fetch completion by year' },
      { status: 500 }
    );
  }
}



