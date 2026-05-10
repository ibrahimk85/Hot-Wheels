'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, Calendar, Target, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface GoalCardProps {
  goal: {
    id: number;
    name: string;
    description: string | null;
    targetCount: number;
    currentCount: number;
    type: string;
    deadline: Date | null;
    completed: boolean;
    completedAt: Date | null;
  };
  onDelete?: (id: number) => void;
  onEdit?: (id: number) => void;
}

export function GoalCard({ goal, onDelete, onEdit }: GoalCardProps) {
  const progressPercentage =
    goal.targetCount > 0
      ? Math.min((goal.currentCount / goal.targetCount) * 100, 100)
      : 0;

  const remaining = Math.max(goal.targetCount - goal.currentCount, 0);
  const isOverdue =
    goal.deadline && !goal.completed && new Date(goal.deadline) < new Date();

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'model_count':
        return 'Model Sayısı';
      case 'collection_complete':
        return 'Koleksiyon Tamamlama';
      case 'value_target':
        return 'Değer Hedefi';
      case 'year_target':
        return 'Yıl Hedefi';
      default:
        return type;
    }
  };

  return (
    <Card
      className={`${
        goal.completed
          ? 'border-green-500 bg-green-50 dark:bg-green-950'
          : isOverdue
          ? 'border-red-500 bg-red-50 dark:bg-red-950'
          : ''
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">{goal.name}</CardTitle>
              {goal.completed && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </div>
            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {goal.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{getTypeLabel(goal.type)}</span>
              {goal.deadline && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span
                    className={
                      isOverdue ? 'text-red-600 font-semibold' : ''
                    }
                  >
                    {format(new Date(goal.deadline), 'dd MMM yyyy', {
                      locale: tr,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(goal.id)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(goal.id)}
                className="h-8 w-8 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">İlerleme</span>
            <span className="text-sm text-muted-foreground">
              {goal.currentCount} / {goal.targetCount}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {progressPercentage.toFixed(1)}% tamamlandı
          </span>
          {!goal.completed && (
            <span className="text-muted-foreground">
              {remaining} kaldı
            </span>
          )}
          {goal.completed && goal.completedAt && (
            <span className="text-green-600 font-semibold">
              {format(new Date(goal.completedAt), 'dd MMM yyyy', {
                locale: tr,
              })}{' '}
              tamamlandı
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}




