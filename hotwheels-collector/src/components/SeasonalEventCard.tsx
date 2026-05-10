'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Gift, Users } from 'lucide-react';
import { format } from 'date-fns';

interface SeasonalEvent {
  id: number;
  name: string;
  description: string | null;
  startDate: string | Date;
  endDate: string | Date;
  type: string;
  rewards: string | null;
  active: boolean;
  progress?: number;
  completed?: boolean;
}

interface SeasonalEventCardProps {
  event: SeasonalEvent;
  onJoin?: (eventId: number) => void;
}

export function SeasonalEventCard({ event, onJoin }: SeasonalEventCardProps) {
  const startDate = event.startDate instanceof Date 
    ? event.startDate 
    : new Date(event.startDate);
  const endDate = event.endDate instanceof Date 
    ? event.endDate 
    : new Date(event.endDate);
  const isActive = new Date() >= startDate && new Date() <= endDate;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'holiday':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'anniversary':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'special':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'challenge':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {event.name}
              <Badge className={getTypeColor(event.type)}>{event.type}</Badge>
            </CardTitle>
            <CardDescription className="mt-2">
              {event.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {format(startDate, 'd MMM yyyy')} - {format(endDate, 'd MMM yyyy')}
              </span>
            </div>
          </div>

          {event.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>İlerleme</span>
                <span>{event.progress}%</span>
              </div>
              <Progress value={event.progress} />
            </div>
          )}

          {event.rewards && (
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4" />
              <span>Ödüller: {event.rewards}</span>
            </div>
          )}

          {isActive && onJoin && !event.completed && (
            <Button onClick={() => onJoin(event.id)} className="w-full">
              Katıl
            </Button>
          )}

          {event.completed && (
            <Badge variant="default" className="w-full justify-center">
              Tamamlandı ✓
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



