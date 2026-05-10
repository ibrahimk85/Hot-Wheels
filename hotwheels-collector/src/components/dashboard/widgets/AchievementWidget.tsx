'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Star } from 'lucide-react';

interface AchievementWidgetProps {
  config: {
    title?: string;
    limit?: number;
    showRecent?: boolean;
  };
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  rarity: string;
  icon?: string;
  unlockedAt?: string;
  completed: boolean;
}

export function AchievementWidget({ config }: AchievementWidgetProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/achievements?limit=${config.limit || 5}`)
      .then((res) => res.json())
      .then((data) => {
        setAchievements(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [config.limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title || 'Başarımlar'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-purple-100 text-purple-800';
      case 'epic':
        return 'bg-blue-100 text-blue-800';
      case 'rare':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {config.title || 'Başarımlar'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {achievements.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Başarım bulunamadı
            </div>
          ) : (
            achievements.map((achievement) => (
              <Link
                key={achievement.id}
                href="/achievements"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0">
                  {achievement.icon ? (
                    <span className="text-2xl">{achievement.icon}</span>
                  ) : (
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{achievement.name}</span>
                    <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                      {achievement.rarity}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {achievement.description}
                  </div>
                  {achievement.unlockedAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(achievement.unlockedAt).toLocaleDateString('tr-TR')}
                    </div>
                  )}
                </div>
                {achievement.completed && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}



