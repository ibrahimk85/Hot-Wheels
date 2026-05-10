import { NextResponse } from 'next/server';
import { getCompletionSuggestions } from '@/features/recommendations/recommendation.service';

export async function GET() {
  try {
    const suggestions = await getCompletionSuggestions(50, 10);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching completion suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch completion suggestions' },
      { status: 500 }
    );
  }
}




