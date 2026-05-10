import { NextResponse } from 'next/server';
import { findDuplicateVariants } from '@/features/data-management/duplicate-detection.service';

export async function GET() {
  try {
    const duplicates = await findDuplicateVariants();
    return NextResponse.json(duplicates);
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return NextResponse.json(
      { error: 'Duplicate detection failed' },
      { status: 500 }
    );
  }
}



