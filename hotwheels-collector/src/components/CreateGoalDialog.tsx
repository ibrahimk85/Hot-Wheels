'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGoalDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [type, setType] = useState<string>('model_count');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          targetCount: Number(targetCount),
          type,
          deadline: deadline || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to create goal: ${response.status}`
        );
      }

      // Reset form
      setName('');
      setDescription('');
      setTargetCount('');
      setType('model_count');
      setDeadline('');

      onSuccess();
    } catch (error) {
      console.error('Error creating goal:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Hedef oluşturulurken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Hedef Oluştur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Hedef Adı *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Örn: 2025 yılında 100 model"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hedef hakkında notlar..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Hedef Tipi *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="model_count">Model Sayısı</SelectItem>
                <SelectItem value="collection_complete">
                  Koleksiyon Tamamlama
                </SelectItem>
                <SelectItem value="value_target">Değer Hedefi</SelectItem>
                <SelectItem value="year_target">Yıl Hedefi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetCount">Hedef Sayı *</Label>
            <Input
              id="targetCount"
              type="number"
              min="1"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              required
              placeholder="100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Son Tarih</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

