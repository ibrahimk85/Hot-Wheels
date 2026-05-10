'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  name: string;
  description: string;
  icon: string | null;
  rarity: string;
  unlocked: boolean;
  progress: number;
  progressMax: number;
  unlockedAt: Date | null;
}

const rarityColors: Record<string, string> = {
  common: 'border-gray-300 bg-gray-50',
  rare: 'border-blue-300 bg-blue-50',
  epic: 'border-purple-300 bg-purple-50',
  legendary: 'border-yellow-300 bg-yellow-50',
};

const rarityLabels: Record<string, string> = {
  common: 'Yaygın',
  rare: 'Nadir',
  epic: 'Efsanevi',
  legendary: 'Efsane',
};

export function AchievementBadge({
  name,
  description,
  icon,
  rarity,
  unlocked,
  progress,
  progressMax,
  unlockedAt,
}: AchievementBadgeProps) {
  const progressPercentage = progressMax > 0 ? (progress / progressMax) * 100 : 0;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:shadow-md',
        rarityColors[rarity] || rarityColors.common,
        unlocked && 'ring-2 ring-primary'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-4xl flex-shrink-0">
            {icon || '🏆'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm">{name}</h3>
              {unlocked ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Lock className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">{description}</p>
            {!unlocked && progressMax > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">İlerleme</span>
                  <span className="font-medium">
                    {progress} / {progressMax}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-1.5" />
              </div>
            )}
            {unlocked && unlockedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Kazanıldı: {new Date(unlockedAt).toLocaleDateString('tr-TR')}
              </p>
            )}
            <div className="mt-2">
              <span
                className={cn(
                  'inline-block px-2 py-0.5 text-xs rounded-full',
                  rarity === 'common' && 'bg-gray-200 text-gray-700',
                  rarity === 'rare' && 'bg-blue-200 text-blue-700',
                  rarity === 'epic' && 'bg-purple-200 text-purple-700',
                  rarity === 'legendary' && 'bg-yellow-200 text-yellow-700'
                )}
              >
                {rarityLabels[rarity] || rarity}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




