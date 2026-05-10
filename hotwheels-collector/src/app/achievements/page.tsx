import { getAllAchievements, checkAndUnlockAchievements, updateStreak } from '@/features/gamification/achievement.service';
import { AchievementBadge } from '@/components/AchievementBadge';
import { Leaderboard } from '@/components/Leaderboard';
import { getLeaderboard } from '@/features/gamification/achievement.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Flame } from 'lucide-react';
import prisma from '@/db';

export default async function AchievementsPage() {
  // Achievement'ları kontrol et ve unlock et
  await checkAndUnlockAchievements();
  
  // Streak güncelle
  const streak = await updateStreak();
  
  // Achievement'ları getir
  const achievements = await getAllAchievements();
  
  // Leaderboard verileri
  const leaderboardData = await getLeaderboard();

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  // Rarity'ye göre grupla
  const groupedByRarity = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.rarity]) {
      acc[achievement.rarity] = [];
    }
    acc[achievement.rarity].push(achievement);
    return acc;
  }, {} as Record<string, typeof achievements>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Başarımlar</h2>
      </div>

      {/* Streak Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Günlük Giriş Serisi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-orange-600">{streak.currentDays}</div>
              <div className="text-sm text-muted-foreground">Günlük Seri</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{streak.longestDays}</div>
              <div className="text-sm text-muted-foreground">En Uzun Seri</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Başarım İlerlemesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {unlockedCount} / {totalCount}
            </div>
            <div className="text-sm text-muted-foreground">
              Başarım kazanıldı ({Math.round((unlockedCount / totalCount) * 100)}%)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements by Rarity */}
      {Object.entries(groupedByRarity).map(([rarity, rarityAchievements]) => (
        <div key={rarity} className="space-y-4">
          <h3 className="text-lg font-semibold capitalize">
            {rarity === 'common' && 'Yaygın'}
            {rarity === 'rare' && 'Nadir'}
            {rarity === 'epic' && 'Efsanevi'}
            {rarity === 'legendary' && 'Efsane'} Başarımlar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rarityAchievements.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                name={achievement.name}
                description={achievement.description}
                icon={achievement.icon}
                rarity={achievement.rarity}
                unlocked={achievement.unlocked}
                progress={achievement.progress}
                progressMax={achievement.progressMax}
                unlockedAt={achievement.unlockedAt}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Leaderboard */}
      <Leaderboard data={leaderboardData} />
    </div>
  );
}




