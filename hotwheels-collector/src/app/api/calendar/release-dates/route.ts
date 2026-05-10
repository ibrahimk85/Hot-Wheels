import { NextRequest, NextResponse } from 'next/server';
import {
  createReleaseDate,
  getReleaseDates,
  getUpcomingReleases,
} from '@/features/calendar/release-date.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const collectionId = searchParams.get('collectionId');
    const subSeriesId = searchParams.get('subSeriesId');
    const modelId = searchParams.get('modelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const confirmed = searchParams.get('confirmed');
    const days = searchParams.get('days');

    if (type === 'upcoming') {
      const releases = await getUpcomingReleases(
        days ? parseInt(days) : 30
      );
      return NextResponse.json(releases);
    }

    const filters: any = {};
    if (collectionId) filters.collectionId = parseInt(collectionId);
    if (subSeriesId) filters.subSeriesId = parseInt(subSeriesId);
    if (modelId) filters.modelId = parseInt(modelId);
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (confirmed) filters.confirmed = confirmed === 'true';

    const releaseDates = await getReleaseDates(filters);
    return NextResponse.json(releaseDates);
  } catch (error) {
    console.error('Error fetching release dates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch release dates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const releaseDate = await createReleaseDate(data);
    return NextResponse.json(releaseDate);
  } catch (error) {
    console.error('Error creating release date:', error);
    return NextResponse.json(
      { error: 'Failed to create release date' },
      { status: 500 }
    );
  }
}

