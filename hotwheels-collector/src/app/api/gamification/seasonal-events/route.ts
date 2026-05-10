import { NextRequest, NextResponse } from 'next/server';
import {
  createSeasonalEvent,
  getActiveSeasonalEvents,
} from '@/features/gamification/seasonal-event.service';

export async function GET() {
  try {
    const events = await getActiveSeasonalEvents();
    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching seasonal events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasonal events', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = await createSeasonalEvent({
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      type: body.type,
      rewards: body.rewards,
      active: body.active !== undefined ? body.active : true,
    });

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error creating seasonal event:', error);
    return NextResponse.json(
      { error: 'Failed to create seasonal event', details: error.message },
      { status: 500 }
    );
  }
}



