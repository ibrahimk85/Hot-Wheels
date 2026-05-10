import { NextResponse } from 'next/server';
import { validateDataConsistency } from '@/features/data-management/validation.service';

export async function GET() {
  try {
    const result = await validateDataConsistency();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}



