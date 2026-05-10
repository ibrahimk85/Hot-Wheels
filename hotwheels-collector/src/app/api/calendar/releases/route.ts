import { NextRequest, NextResponse } from 'next/server';
import {
  createReleaseDate,
  getReleaseDates,
  getUpcomingReleases,
} from '@/features/calendar/release-date.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const upcoming = searchParams.get('upcoming');
    const days = searchParams.get('days');

    if (upcoming === 'true') {
      const releases = await getUpcomingReleases(days ? parseInt(days) : 30);
      return NextResponse.json(releases);
    }

    const collectionId = searchParams.get('collectionId');
    const subSeriesId = searchParams.get('subSeriesId');
    const modelId = searchParams.get('modelId');
    const region = searchParams.get('region');
    const confirmed = searchParams.get('confirmed');

    const releases = await getReleaseDates({
      collectionId: collectionId ? parseInt(collectionId) : undefined,
      subSeriesId: subSeriesId ? parseInt(subSeriesId) : undefined,
      modelId: modelId ? parseInt(modelId) : undefined,
      region: region || undefined,
      confirmed: confirmed === 'true' ? true : confirmed === 'false' ? false : undefined,
    });

    return NextResponse.json(releases);
  } catch (error: any) {
    console.error('Error fetching release dates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch release dates', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const releaseDate = await createReleaseDate({
      collectionId: body.collectionId,
      subSeriesId: body.subSeriesId,
      modelId: body.modelId,
      releaseDate: new Date(body.releaseDate),
      region: body.region,
      source: body.source || 'manual',
      confirmed: body.confirmed || false,
      notes: body.notes,
    });

    return NextResponse.json(releaseDate);
  } catch (error) {
    console.error('Error creating release date:', error);
    return NextResponse.json(
      { error: 'Failed to create release date' },
      { status: 500 }
    );
  }
}

