import { NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET() {
  try {
    const years = await prisma.year.findMany({
      orderBy: {
        year: 'desc', // En yeni yıllar önce
      },
      select: {
        id: true,
        year: true,
      },
    });

    return NextResponse.json(years);
  } catch (error: any) {
    console.error('[Years API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch years',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

