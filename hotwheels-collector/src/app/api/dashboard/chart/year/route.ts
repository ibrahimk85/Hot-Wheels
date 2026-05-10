import { NextResponse } from 'next/server';
import { getYearDistribution } from '@/features/analytics/analytics.service';

export async function GET() {
  try {
    const distribution = await getYearDistribution();
    const data = distribution.map((item) => ({
      name: item.year.toString(),
      value: item.count,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching year chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}



