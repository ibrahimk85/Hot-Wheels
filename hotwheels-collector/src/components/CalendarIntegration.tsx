'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Plus, Loader2, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  eventType: string;
  startDate: string | Date;
  endDate: string | Date | null;
  location: string | null;
  url: string | null;
  reminder: boolean;
  reminderDays: number | null;
  synced: boolean;
  calendarType: string | null;
}

export function CalendarIntegration() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'custom',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endDate: '',
    endTime: '',
    location: '',
    url: '',
    reminder: false,
    reminderDays: 1,
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/calendar/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const startDateTime = new Date(
        `${formData.startDate}T${formData.startTime}`
      );
      const endDateTime = formData.endDate
        ? new Date(`${formData.endDate}T${formData.endTime || formData.startTime}`)
        : undefined;

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventType: formData.eventType,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime?.toISOString(),
          location: formData.location,
          url: formData.url,
          reminder: formData.reminder,
          reminderDays: formData.reminderDays,
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchEvents();
        setFormData({
          title: '',
          description: '',
          eventType: 'custom',
          startDate: new Date().toISOString().split('T')[0],
          startTime: '10:00',
          endDate: '',
          endTime: '',
          location: '',
          url: '',
          reminder: false,
          reminderDays: 1,
        });
      }
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleExportICal = async (eventId: number) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}/ical`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-${eventId}.ics`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting iCal:', error);
    }
  };

  const upcomingEvents = events
    .filter((event) => {
      try {
        const startDate = event.startDate instanceof Date 
          ? event.startDate 
          : new Date(event.startDate);
        return startDate >= new Date();
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const dateA = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
      const dateB = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Takvim Etkinlikleri</CardTitle>
              <CardDescription>
                Fuarlar, yarışmalar ve özel etkinlikleri takip edin
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Etkinlik
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Yeni Etkinlik Ekle</DialogTitle>
                  <DialogDescription>
                    Yeni bir takvim etkinliği ekleyin
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Başlık</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Açıklama</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eventType">Etkinlik Türü</Label>
                      <Select
                        value={formData.eventType}
                        onValueChange={(value) =>
                          setFormData({ ...formData, eventType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="release">Çıkış</SelectItem>
                          <SelectItem value="fair">Fuar</SelectItem>
                          <SelectItem value="competition">Yarışma</SelectItem>
                          <SelectItem value="custom">Özel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="location">Konum</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) =>
                          setFormData({ ...formData, startDate: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="startTime">Başlangıç Saati</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) =>
                          setFormData({ ...formData, startTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="endDate">Bitiş Tarihi (Opsiyonel)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) =>
                          setFormData({ ...formData, endDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">Bitiş Saati</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) =>
                          setFormData({ ...formData, endTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) =>
                        setFormData({ ...formData, url: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="reminder"
                        checked={formData.reminder}
                        onChange={(e) =>
                          setFormData({ ...formData, reminder: e.target.checked })
                        }
                        className="rounded"
                      />
                      <Label htmlFor="reminder">Hatırlatıcı</Label>
                    </div>
                    {formData.reminder && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="reminderDays">Gün önce</Label>
                        <Input
                          id="reminderDays"
                          type="number"
                          min="1"
                          value={formData.reminderDays}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              reminderDays: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit">Ekle</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Yaklaşan etkinlik yok
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          <Badge variant="secondary">{event.eventType}</Badge>
                          {event.synced && (
                            <Badge variant="outline">
                              {event.calendarType || 'Synced'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(
                            event.startDate instanceof Date 
                              ? event.startDate 
                              : new Date(event.startDate),
                            'd MMMM yyyy, HH:mm'
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm mt-2">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="text-sm text-muted-foreground mt-1">
                            📍 {event.location}
                          </p>
                        )}
                        {event.reminder && event.reminderDays && (
                          <p className="text-xs text-muted-foreground mt-1">
                            🔔 {event.reminderDays} gün önce hatırlat
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {event.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={event.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportICal(event.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          iCal
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

