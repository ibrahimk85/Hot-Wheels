import { NextRequest, NextResponse } from 'next/server';
import {
  createCalendarEvent,
  getCalendarEvents,
  getUpcomingEvents,
} from '@/features/calendar/calendar-event.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const upcoming = searchParams.get('upcoming');
    const days = searchParams.get('days');

    if (upcoming === 'true') {
      const events = await getUpcomingEvents(days ? parseInt(days) : 30);
      return NextResponse.json(events);
    }

    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const reminder = searchParams.get('reminder');

    const events = await getCalendarEvents({
      userId: userId ? parseInt(userId) : undefined,
      eventType: eventType || undefined,
      reminder: reminder === 'true' ? true : undefined,
    });

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = await createCalendarEvent({
      userId: body.userId,
      title: body.title,
      description: body.description,
      eventType: body.eventType,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      location: body.location,
      url: body.url,
      reminder: body.reminder || false,
      reminderDays: body.reminderDays,
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
