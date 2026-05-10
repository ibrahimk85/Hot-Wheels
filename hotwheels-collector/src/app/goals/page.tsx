'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoalCard } from '@/components/GoalCard';
import { CreateGoalDialog } from '@/components/CreateGoalDialog';
import { Plus, Target } from 'lucide-react';

interface Goal {
  id: number;
  name: string;
  description: string | null;
  targetCount: number;
  currentCount: number;
  type: string;
  targetId: number | null;
  deadline: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/goals');
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Bu hedefi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadGoals();
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Hedef silinirken bir hata oluştu.');
    }
  };

  const handleCreate = async () => {
    await loadGoals();
    setCreateDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Hedefler</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Yükleniyor...
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          <h2 className="text-2xl font-semibold">Hedefler</h2>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Hedef
        </Button>
      </div>

      <CreateGoalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreate}
      />

      {goals.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Henüz hedef oluşturulmamış. Yeni bir hedef oluşturmak için yukarıdaki
            butona tıklayın.
          </CardContent>
        </Card>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Aktif Hedefler</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tamamlanan Hedefler</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}




