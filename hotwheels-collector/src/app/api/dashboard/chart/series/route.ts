import { NextResponse } from 'next/server';
import { getTopSeries } from '@/features/analytics/analytics.service';

export async function GET() {
  try {
    const series = await getTopSeries(10);
    const data = series.map((item) => ({
      name: item.name,
      value: item.count,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching series chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}



