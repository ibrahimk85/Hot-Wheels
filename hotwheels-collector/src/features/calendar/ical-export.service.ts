/**
 * iCal export service
 * iCal formatında takvim dosyası oluşturur
 */

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
  url?: string | null;
}

/**
 * iCal formatında takvim dosyası oluştur
 */
export function generateICal(events: ICalEvent[]): string {
  const lines: string[] = [];

  // Header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Hot Wheels Collector//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  // Events
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }

    lines.push(`DTSTART:${formatICalDate(event.startDate)}`);
    
    if (event.endDate) {
      lines.push(`DTEND:${formatICalDate(event.endDate)}`);
    } else {
      // Default: 1 hour duration
      const endDate = new Date(event.startDate);
      endDate.setHours(endDate.getHours() + 1);
      lines.push(`DTEND:${formatICalDate(endDate)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }

    if (event.url) {
      lines.push(`URL:${event.url}`);
    }

    lines.push('END:VEVENT');
  }

  // Footer
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * iCal date formatı
 */
function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * iCal text escape
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

