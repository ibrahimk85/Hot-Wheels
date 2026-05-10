import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
} from '@/features/filters/filter.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'variants' | 'models' | null;

    const filters = await getAllSavedFilters(type || undefined);
    return NextResponse.json(filters);
  } catch (error) {
    console.error('Error fetching saved filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved filters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, filterData, type } = body;

    if (!name || !filterData || !type) {
      return NextResponse.json(
        { error: 'name, filterData, and type are required' },
        { status: 400 }
      );
    }

    const savedFilter = await createSavedFilter({
      name,
      filterData: JSON.stringify(filterData),
      type: type as 'variants' | 'models',
    });

    return NextResponse.json(savedFilter);
  } catch (error) {
    console.error('Error creating saved filter:', error);
    return NextResponse.json(
      { error: 'Failed to create saved filter' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const success = await deleteSavedFilter(Number(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete saved filter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved filter:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved filter' },
      { status: 500 }
    );
  }
}




