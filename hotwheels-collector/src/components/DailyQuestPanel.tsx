'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Target } from 'lucide-react';

interface DailyQuest {
  id: number;
  name: string;
  description: string | null;
  type: string;
  targetValue: number;
  xpReward: number;
  reward: string | null;
  progress?: number;
  completed?: boolean;
}

export function DailyQuestPanel() {
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchQuests();
  }, []);

  const fetchQuests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gamification/daily-quests');
      if (response.ok) {
        const data = await response.json();
        setQuests(data);
      }
    } catch (error) {
      console.error('Error fetching daily quests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuestTypeLabel = (type: string) => {
    switch (type) {
      case 'add_model':
        return 'Model Ekle';
      case 'add_variant':
        return 'Varyant Ekle';
      case 'complete_collection':
        return 'Koleksiyon Tamamla';
      case 'share':
        return 'Paylaş';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Günlük Görevler
        </CardTitle>
        <CardDescription>
          Bugünün görevlerini tamamlayarak XP kazanın
        </CardDescription>
      </CardHeader>
      <CardContent>
        {quests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Bugün için görev yok
          </p>
        ) : (
          <div className="space-y-4">
            {quests.map((quest) => (
              <Card key={quest.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold">{quest.name}</h3>
                      {quest.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {quest.description}
                        </p>
                      )}
                    </div>
                    {quest.completed && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">
                      {getQuestTypeLabel(quest.type)}
                    </Badge>
                    <Badge variant="outline">
                      +{quest.xpReward} XP
                    </Badge>
                  </div>
                  {quest.progress !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {quest.progress} / {quest.targetValue}
                        </span>
                        <span>
                          {Math.min(100, Math.round((quest.progress / quest.targetValue) * 100))}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (quest.progress / quest.targetValue) * 100)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



