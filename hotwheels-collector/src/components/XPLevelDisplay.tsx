'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp } from 'lucide-react';
import { calculateLevelProgress, UserXPData } from '@/features/gamification/xp-level.service';

export function XPLevelDisplay() {
  const [userXP, setUserXP] = useState<UserXPData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserXP();
  }, []);

  const fetchUserXP = async () => {
    setLoading(true);
    try {
      // Şimdilik userId=1 kullanıyoruz, gerçek uygulamada auth'dan alınmalı
      const response = await fetch('/api/gamification/xp?userId=1');
      if (response.ok) {
        const data = await response.json();
        setUserXP(data);
      }
    } catch (error) {
      console.error('Error fetching user XP:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !userXP) {
    return null;
  }

  const progress = calculateLevelProgress(userXP);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Seviye {userXP.currentLevel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{userXP.totalXP} XP</div>
              <div className="text-sm text-muted-foreground">
                Seviye {userXP.currentLevel}
              </div>
            </div>
            <Badge variant="secondary" className="text-lg">
              <TrendingUp className="h-4 w-4 mr-1" />
              {userXP.currentLevel}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Seviye İlerlemesi</span>
              <span>
                {userXP.levelXP} / {userXP.nextLevelXP} XP
              </span>
            </div>
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground text-center">
              Seviye {userXP.currentLevel + 1} için {userXP.nextLevelXP - userXP.levelXP} XP kaldı
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

