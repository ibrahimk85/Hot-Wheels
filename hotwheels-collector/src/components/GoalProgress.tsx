'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface GoalProgressProps {
  current: number;
  target: number;
  label?: string;
}

export function GoalProgress({
  current,
  target,
  label = 'İlerleme',
}: GoalProgressProps) {
  const percentage =
    target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const remaining = Math.max(target - current, 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-sm text-muted-foreground">
              {current} / {target}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{percentage.toFixed(1)}% tamamlandı</span>
            {remaining > 0 && <span>{remaining} kaldı</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




