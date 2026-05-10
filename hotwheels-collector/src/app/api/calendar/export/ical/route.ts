import { NextRequest, NextResponse } from 'next/server';
import { getCalendarEvents } from '@/features/calendar/calendar-event.service';
import { generateICal } from '@/features/calendar/ical-export.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: any = {};
    if (userId) filters.userId = parseInt(userId);
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const events = await getCalendarEvents(filters);

    const iCalEvents = events.map((event) => ({
      uid: `hotwheels-${event.id}@collector`,
      summary: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      url: event.url,
    }));

    const iCalContent = generateICal(iCalEvents);

    return new NextResponse(iCalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hotwheels-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Error exporting iCal:', error);
    return NextResponse.json(
      { error: 'Failed to export calendar' },
      { status: 500 }
    );
  }
}

