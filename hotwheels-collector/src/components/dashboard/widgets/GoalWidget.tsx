'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, CheckCircle2 } from 'lucide-react';

interface GoalWidgetProps {
  config: {
    title?: string;
    limit?: number;
    showCompleted?: boolean;
  };
}

interface Goal {
  id: number;
  name: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  deadline?: string;
}

export function GoalWidget({ config }: GoalWidgetProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/goals?limit=${config.limit || 3}`)
      .then((res) => res.json())
      .then((data) => {
        const filtered = config.showCompleted !== false
          ? data
          : data.filter((g: Goal) => !g.completed);
        setGoals(filtered.slice(0, config.limit || 3));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [config.limit, config.showCompleted]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title || 'Hedefler'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {config.title || 'Hedefler'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Aktif hedef bulunamadı
            </div>
          ) : (
            goals.map((goal) => {
              const progress = goal.targetCount > 0
                ? (goal.currentCount / goal.targetCount) * 100
                : 0;

              return (
                <Link
                  key={goal.id}
                  href="/goals"
                  className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {goal.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{goal.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {goal.currentCount} / {goal.targetCount}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  {goal.deadline && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Bitiş: {new Date(goal.deadline).toLocaleDateString('tr-TR')}
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}



