'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Award, TrendingUp } from 'lucide-react';

interface LeaderboardData {
  topModels: number;
  topVariants: number;
  topCollections: Array<{
    name: string;
    year: number;
    value: number;
    count: number;
  }>;
}

interface LeaderboardProps {
  data: LeaderboardData;
}

export function Leaderboard({ data }: LeaderboardProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Koleksiyon İstatistikleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Award className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{data.topModels}</div>
              <div className="text-sm text-muted-foreground">Toplam Model</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{data.topVariants}</div>
              <div className="text-sm text-muted-foreground">Toplam Varyant</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">
                {data.topCollections.length}
              </div>
              <div className="text-sm text-muted-foreground">Koleksiyon</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.topCollections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>En Değerli Koleksiyonlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topCollections.map((collection, index) => (
                <div
                  key={`${collection.name}-${collection.year}`}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{collection.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {collection.year} • {collection.count} model
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {collection.value.toFixed(2)} TL
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}




