'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  id: number;
  userId: number | null;
  score: number;
  rank: number | null;
  userName?: string;
}

interface CompetitionLeaderboardProps {
  competitionId: number;
  entries: LeaderboardEntry[];
}

export function CompetitionLeaderboard({
  competitionId,
  entries,
}: CompetitionLeaderboardProps) {
  const getRankIcon = (rank: number | null) => {
    if (!rank) return null;
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-orange-600" />;
    return null;
  };

  const getRankColor = (rank: number | null) => {
    if (!rank) return '';
    if (rank === 1) return 'bg-yellow-100 dark:bg-yellow-900';
    if (rank === 2) return 'bg-gray-100 dark:bg-gray-800';
    if (rank === 3) return 'bg-orange-100 dark:bg-orange-900';
    return '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liderlik Tablosu</CardTitle>
        <CardDescription>
          En yüksek skorlara sahip koleksiyoncular
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Henüz katılım yok
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.rank ? getRankColor(entry.rank) : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(entry.rank)}
                  <div className="flex items-center gap-2">
                    {entry.rank && (
                      <span className="font-bold text-lg w-8">
                        #{entry.rank}
                      </span>
                    )}
                    <span className="font-medium">
                      {entry.userName || `Kullanıcı ${entry.userId || 'N/A'}`}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {entry.score.toFixed(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



