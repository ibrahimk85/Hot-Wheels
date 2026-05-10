import { NextResponse } from 'next/server';
import { getCollectionDistribution } from '@/features/analytics/analytics.service';

export async function GET() {
  try {
    const distribution = await getCollectionDistribution();
    const data = distribution.map((item) => ({
      name: item.name,
      value: item.count,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching collection chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}



