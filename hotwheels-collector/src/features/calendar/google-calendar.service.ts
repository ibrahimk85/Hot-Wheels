import { google } from 'googleapis';

export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

/**
 * Google Calendar API ile event oluştur
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent
): Promise<{ id: string; htmlLink: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  if (!response.data.id || !response.data.htmlLink) {
    throw new Error('Failed to create calendar event');
  }

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
  };
}

/**
 * Google Calendar API ile event güncelle
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<void> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
}

/**
 * Google Calendar API ile event sil
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

/**
 * iCal formatında event oluştur
 */
export function generateICalEvent(event: {
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
  url?: string | null;
}): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hot Wheels Collector//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@hotwheels-collector`,
    `DTSTART:${formatDate(event.startDate)}`,
    event.endDate ? `DTEND:${formatDate(event.endDate)}` : `DTEND:${formatDate(event.startDate)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    event.url ? `URL:${event.url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

