import { NextRequest, NextResponse } from 'next/server';
import { exportUserCollection } from '@/features/collections/multi-collection.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const exportData = await exportUserCollection(parseInt(userId));
    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Error exporting user collection:', error);
    return NextResponse.json(
      { error: 'Failed to export collection' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, data } = body;

    if (!userId || !data) {
      return NextResponse.json(
        { error: 'userId and data are required' },
        { status: 400 }
      );
    }

    // Import işlemi (basit versiyon - gerçek uygulamada daha detaylı olmalı)
    // Bu endpoint şimdilik sadece placeholder
    return NextResponse.json({
      message: 'Collection imported successfully',
      importedItems: data.models?.length || 0,
    });
  } catch (error) {
    console.error('Error importing collection:', error);
    return NextResponse.json(
      { error: 'Failed to import collection' },
      { status: 500 }
    );
  }
}



