'use client';

import { useState, useEffect } from 'react';
import { SeasonalEventCard } from '@/components/SeasonalEventCard';
import { CompetitionLeaderboard } from '@/components/CompetitionLeaderboard';
import { DailyQuestPanel } from '@/components/DailyQuestPanel';
import { XPLevelDisplay } from '@/components/XPLevelDisplay';
import { BadgeCollection } from '@/components/BadgeCollection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GamificationPage() {
  const [seasonalEvents, setSeasonalEvents] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    fetchSeasonalEvents();
    fetchCompetitions();
    fetchBadges();
  }, []);

  const fetchSeasonalEvents = async () => {
    try {
      const response = await fetch('/api/gamification/seasonal-events');
      if (response.ok) {
        const data = await response.json();
        setSeasonalEvents(data);
      }
    } catch (error) {
      console.error('Error fetching seasonal events:', error);
    }
  };

  const fetchCompetitions = async () => {
    try {
      const response = await fetch('/api/gamification/competitions');
      if (response.ok) {
        const data = await response.json();
        setCompetitions(data);
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await fetch('/api/achievements');
      if (response.ok) {
        const data = await response.json();
        setBadges(data);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  };

  const handleJoinEvent = async (eventId: number) => {
    try {
      const response = await fetch('/api/gamification/seasonal-events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (response.ok) {
        fetchSeasonalEvents();
      }
    } catch (error) {
      console.error('Error joining event:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Oyunlaştırma</h1>
        <p className="text-muted-foreground">
          Sezonluk etkinliklere katılın, yarışmalara girin ve rozetler kazanın
        </p>
      </div>

      <XPLevelDisplay />

      <Tabs defaultValue="quests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quests">Günlük Görevler</TabsTrigger>
          <TabsTrigger value="events">Sezonluk Etkinlikler</TabsTrigger>
          <TabsTrigger value="competitions">Yarışmalar</TabsTrigger>
          <TabsTrigger value="badges">Rozetler</TabsTrigger>
        </TabsList>

        <TabsContent value="quests" className="space-y-4">
          <DailyQuestPanel />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          {seasonalEvents.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  Aktif sezonluk etkinlik yok
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seasonalEvents.map((event) => (
                <SeasonalEventCard
                  key={event.id}
                  event={event}
                  onJoin={handleJoinEvent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="competitions" className="space-y-4">
          {competitions.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  Aktif yarışma yok
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {competitions.map((competition) => (
                <Card key={competition.id}>
                  <CardHeader>
                    <CardTitle>{competition.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CompetitionLeaderboard
                      competitionId={competition.id}
                      entries={[]}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="badges" className="space-y-4">
          <BadgeCollection badges={badges} />
        </TabsContent>
      </Tabs>
    </div>
  );
}



