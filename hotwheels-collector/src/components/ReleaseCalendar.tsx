'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
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
import { Calendar as CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ReleaseDate {
  id: number;
  releaseDate: string | Date;
  region: string | null;
  source: string;
  confirmed: boolean;
  notes: string | null;
  collection?: {
    name: string;
    year: { year: number };
  };
  subSeries?: {
    name: string;
  };
  model?: {
    castingName: string;
  };
}

export function ReleaseCalendar() {
  const [releases, setReleases] = useState<ReleaseDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    releaseDate: new Date().toISOString().split('T')[0],
    region: '',
    source: 'manual',
    confirmed: false,
    notes: '',
  });

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/calendar/releases');
      if (response.ok) {
        const data = await response.json();
        setReleases(data);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/calendar/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchReleases();
        setFormData({
          releaseDate: new Date().toISOString().split('T')[0],
          region: '',
          source: 'manual',
          confirmed: false,
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error creating release:', error);
    }
  };

  const selectedDateReleases = releases.filter((release) => {
    if (!selectedDate) return false;
    try {
      const releaseDate = release.releaseDate instanceof Date 
        ? release.releaseDate 
        : new Date(release.releaseDate);
      return (
        releaseDate.getDate() === selectedDate.getDate() &&
        releaseDate.getMonth() === selectedDate.getMonth() &&
        releaseDate.getFullYear() === selectedDate.getFullYear()
      );
    } catch {
      return false;
    }
  });

  const dateHasReleases = (date: Date): boolean => {
    return releases.some((release) => {
      try {
        const releaseDate = release.releaseDate instanceof Date 
          ? release.releaseDate 
          : new Date(release.releaseDate);
        return (
          releaseDate.getDate() === date.getDate() &&
          releaseDate.getMonth() === date.getMonth() &&
          releaseDate.getFullYear() === date.getFullYear()
        );
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Release Calendar</CardTitle>
              <CardDescription>
                Yeni seri çıkış tarihlerini takip edin
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Release Date
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni Release Date Ekle</DialogTitle>
                  <DialogDescription>
                    Yeni bir seri çıkış tarihi ekleyin
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="releaseDate">Çıkış Tarihi</Label>
                    <Input
                      id="releaseDate"
                      type="date"
                      value={formData.releaseDate}
                      onChange={(e) =>
                        setFormData({ ...formData, releaseDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="region">Bölge</Label>
                    <Select
                      value={formData.region}
                      onValueChange={(value) =>
                        setFormData({ ...formData, region: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Bölge seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">ABD</SelectItem>
                        <SelectItem value="EU">Avrupa</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
                        <SelectItem value="TR">Türkiye</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="source">Kaynak</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) =>
                        setFormData({ ...formData, source: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">Resmi</SelectItem>
                        <SelectItem value="wiki">Wiki</SelectItem>
                        <SelectItem value="community">Topluluk</SelectItem>
                        <SelectItem value="manual">Manuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notlar</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
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
          <div className="grid md:grid-cols-2 gap-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{
                hasReleases: (date) => dateHasReleases(date),
              }}
              modifiersClassNames={{
                hasReleases: 'bg-blue-100 dark:bg-blue-900',
              }}
            />
            <div>
              {selectedDate ? (
                <div className="space-y-2">
                  <h3 className="font-semibold">
                    {format(selectedDate, 'd MMMM yyyy')}
                  </h3>
                  {selectedDateReleases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Bu tarihte release date yok
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateReleases.map((release) => (
                        <Card key={release.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {release.collection?.name ||
                                    release.subSeries?.name ||
                                    release.model?.castingName ||
                                    'Release'}
                                </div>
                                {release.collection?.year && (
                                  <div className="text-sm text-muted-foreground">
                                    {release.collection.year.year}
                                  </div>
                                )}
                                {release.notes && (
                                  <div className="text-sm mt-1">{release.notes}</div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                {release.region && (
                                  <Badge variant="secondary">{release.region}</Badge>
                                )}
                                {release.confirmed ? (
                                  <Badge variant="default">Onaylandı</Badge>
                                ) : (
                                  <Badge variant="outline">Onaylanmadı</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bir tarih seçin
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

