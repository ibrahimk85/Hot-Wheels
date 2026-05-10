import { NextResponse } from 'next/server';
import prisma from '@/db';

export async function GET() {
  try {
    const years = await prisma.year.findMany({
      orderBy: { year: 'desc' },
      select: {
        id: true,
        year: true,
      },
    });

    return NextResponse.json(years);
  } catch (error) {
    console.error('Error fetching years:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years' },
      { status: 500 }
    );
  }
}







