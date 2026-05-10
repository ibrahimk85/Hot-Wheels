import { NextRequest, NextResponse } from 'next/server';
import {
  getAdvancedStats,
  getValueByYear,
  getValueByCollection,
  getCollectionGrowthTimeline,
} from '@/features/analytics/advanced-stats.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const year = searchParams.get('year');

    if (type === 'by-year') {
      const data = await getValueByYear();
      return NextResponse.json(data);
    }

    if (type === 'by-collection') {
      const data = await getValueByCollection();
      return NextResponse.json(data);
    }

    if (type === 'growth-timeline') {
      const months = parseInt(searchParams.get('months') || '12');
      const data = await getCollectionGrowthTimeline(months);
      return NextResponse.json(data);
    }

    // Default: advanced stats
    const stats = await getAdvancedStats(
      year ? parseInt(year) : undefined
    );
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching advanced stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advanced stats' },
      { status: 500 }
    );
  }
}



