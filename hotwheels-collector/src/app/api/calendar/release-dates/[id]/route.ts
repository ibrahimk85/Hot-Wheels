import { NextRequest, NextResponse } from 'next/server';
import {
  updateReleaseDate,
  deleteReleaseDate,
} from '@/features/calendar/release-date.service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const data = await request.json();
    const releaseDate = await updateReleaseDate(id, data);
    return NextResponse.json(releaseDate);
  } catch (error) {
    console.error('Error updating release date:', error);
    return NextResponse.json(
      { error: 'Failed to update release date' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    await deleteReleaseDate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting release date:', error);
    return NextResponse.json(
      { error: 'Failed to delete release date' },
      { status: 500 }
    );
  }
}

