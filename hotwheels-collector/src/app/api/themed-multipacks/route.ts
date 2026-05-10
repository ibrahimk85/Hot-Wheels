import { NextRequest, NextResponse } from 'next/server';
import { getThemedMultipacks } from '@/features/themed-multipack/themed-multipack.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const collectionNameParam = searchParams.get('collectionName');
    const collectionIdParam = searchParams.get('collectionId');
    const yearParam = searchParams.get('year');
    const themeParam = searchParams.get('themeName') ?? searchParams.get('theme');
    const packageCodeParam = searchParams.get('packageCode');

    const collectionName = collectionNameParam ?? undefined;

    const collectionId = collectionIdParam
      ? Number(collectionIdParam)
      : undefined;
    const year = yearParam ? Number(yearParam) : undefined;

    const multipacks = await getThemedMultipacks({
      collectionName,
      collectionId:
        typeof collectionId === 'number' && !Number.isNaN(collectionId)
          ? collectionId
          : undefined,
      year:
        typeof year === 'number' && !Number.isNaN(year) ? year : undefined,
      themeName: themeParam ?? undefined,
      packageCode: packageCodeParam ?? undefined,
    });

    return NextResponse.json(multipacks);
  } catch (error) {
    console.error('Error fetching themed multipacks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch themed multipacks' },
      { status: 500 },
    );
  }
}

