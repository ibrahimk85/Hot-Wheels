import { ReleaseCalendar } from '@/components/ReleaseCalendar';
import { CalendarIntegration } from '@/components/CalendarIntegration';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Takvim ve Çıkış Tarihleri</h2>
      </div>

      <ReleaseCalendar />

      <CalendarIntegration />
    </div>
  );
}



