import prisma from '@/db';

export interface CalendarEventData {
  id: number;
  userId: number | null;
  title: string;
  description: string | null;
  eventType: string;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  url: string | null;
  reminder: boolean;
  reminderDays: number | null;
  synced: boolean;
  externalId: string | null;
  calendarType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calendar event oluştur
 */
export async function createCalendarEvent(data: {
  userId?: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  url?: string;
  reminder?: boolean;
  reminderDays?: number;
}): Promise<CalendarEventData> {
  const event = await prisma.calendarEvent.create({
    data: {
      userId: data.userId || null,
      title: data.title,
      description: data.description || null,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate || null,
      location: data.location || null,
      url: data.url || null,
      reminder: data.reminder || false,
      reminderDays: data.reminderDays || null,
      synced: false,
      externalId: null,
      calendarType: null,
    },
  });

  return event as CalendarEventData;
}

/**
 * Calendar event'leri getir
 */
export async function getCalendarEvents(filters?: {
  userId?: number;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  reminder?: boolean;
}): Promise<CalendarEventData[]> {
  const where: any = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.eventType) {
    where.eventType = filters.eventType;
  }

  if (filters?.reminder !== undefined) {
    where.reminder = filters.reminder;
  }

  if (filters?.startDate || filters?.endDate) {
    where.startDate = {};
    if (filters.startDate) {
      where.startDate.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.startDate.lte = filters.endDate;
    }
  }

  try {
    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: {
        startDate: 'asc',
      },
    });

    return events.map((e) => ({
      id: e.id,
      userId: e.userId,
      title: e.title,
      description: e.description,
      eventType: e.eventType,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      url: e.url,
      reminder: e.reminder,
      reminderDays: e.reminderDays,
      synced: e.synced,
      externalId: e.externalId,
      calendarType: e.calendarType,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })) as CalendarEventData[];
  } catch (error: any) {
    console.error('Prisma error in getCalendarEvents:', error);
    throw error;
  }
}

/**
 * Calendar event güncelle
 */
export async function updateCalendarEvent(
  id: number,
  data: {
    title?: string;
    description?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    location?: string;
    url?: string;
    reminder?: boolean;
    reminderDays?: number;
  }
): Promise<CalendarEventData> {
  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate,
      location: data.location,
      url: data.url,
      reminder: data.reminder,
      reminderDays: data.reminderDays,
    },
  });

  return event as CalendarEventData;
}

/**
 * Calendar event sil
 */
export async function deleteCalendarEvent(id: number): Promise<void> {
  await prisma.calendarEvent.delete({
    where: { id },
  });
}

/**
 * Yaklaşan event'leri getir
 */
export async function getUpcomingEvents(days: number = 30): Promise<CalendarEventData[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return getCalendarEvents({
    startDate: today,
    endDate: futureDate,
  });
}

/**
 * Hatırlatıcı kontrolü
 */
export async function checkReminders(): Promise<CalendarEventData[]> {
  const today = new Date();
  const events = await prisma.calendarEvent.findMany({
    where: {
      reminder: true,
      startDate: {
        gte: today,
      },
    },
  });

  const reminders: CalendarEventData[] = [];

  for (const event of events) {
    if (event.reminderDays) {
      const reminderDate = new Date(event.startDate);
      reminderDate.setDate(reminderDate.getDate() - event.reminderDays);

      if (reminderDate <= today && today < event.startDate) {
        reminders.push(event as CalendarEventData);
      }
    }
  }

  return reminders;
}
