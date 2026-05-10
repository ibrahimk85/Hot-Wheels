import { NextRequest, NextResponse } from 'next/server';
import { getCalendarEvents } from '@/features/calendar/calendar-event.service';
import { generateICalEvent } from '@/features/calendar/google-calendar.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    const events = await getCalendarEvents();
    const event = events.find((e) => e.id === eventId);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const ical = generateICalEvent({
      title: event.title,
      description: event.description || undefined,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      location: event.location || undefined,
      url: event.url || undefined,
    });

    return new NextResponse(ical, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${eventId}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error generating iCal:', error);
    return NextResponse.json(
      { error: 'Failed to generate iCal' },
      { status: 500 }
    );
  }
}

