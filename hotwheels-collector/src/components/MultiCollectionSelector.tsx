'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Collection {
  id: number;
  name: string;
  code: string | null;
  year: {
    id: number;
    year: number;
  };
}

interface UserCollection {
  id: number;
  collectionId: number;
  isDefault: boolean;
  collection: Collection;
}

interface MultiCollectionSelectorProps {
  userId: number;
  selectedCollectionId?: number;
  onCollectionChange?: (collectionId: number) => void;
}

export function MultiCollectionSelector({
  userId,
  selectedCollectionId,
  onCollectionChange,
}: MultiCollectionSelectorProps) {
  const [userCollections, setUserCollections] = useState<UserCollection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');

  useEffect(() => {
    fetchUserCollections();
    fetchAllCollections();
  }, [userId]);

  const fetchUserCollections = async () => {
    try {
      const response = await fetch(`/api/collections/user?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserCollections(data);
      }
    } catch (error) {
      console.error('Error fetching user collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        setAllCollections(data);
      }
    } catch (error) {
      console.error('Error fetching all collections:', error);
    }
  };

  const handleAddCollection = async () => {
    if (!selectedCollection) return;

    try {
      const response = await fetch('/api/collections/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          collectionId: parseInt(selectedCollection),
          isDefault: userCollections.length === 0, // İlk koleksiyon default olsun
        }),
      });

      if (response.ok) {
        await fetchUserCollections();
        setShowAddDialog(false);
        setSelectedCollection('');
      }
    } catch (error) {
      console.error('Error adding collection:', error);
    }
  };

  const handleRemoveCollection = async (collectionId: number) => {
    try {
      const response = await fetch(
        `/api/collections/user?userId=${userId}&collectionId=${collectionId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchUserCollections();
      }
    } catch (error) {
      console.error('Error removing collection:', error);
    }
  };

  const handleSetDefault = async (collectionId: number) => {
    try {
      const response = await fetch('/api/collections/user/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          collectionId,
        }),
      });

      if (response.ok) {
        await fetchUserCollections();
      }
    } catch (error) {
      console.error('Error setting default collection:', error);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Yükleniyor...</div>;
  }

  const availableCollections = allCollections.filter(
    (c) => !userCollections.some((uc) => uc.collectionId === c.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedCollectionId?.toString() || ''}
          onValueChange={(value) => {
            if (onCollectionChange) {
              onCollectionChange(parseInt(value));
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Koleksiyon seçin" />
          </SelectTrigger>
          <SelectContent>
            {userCollections.map((uc) => (
              <SelectItem key={uc.id} value={uc.collectionId.toString()}>
                {uc.collection.name} ({uc.collection.year.year})
                {uc.isDefault && ' (Varsayılan)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Koleksiyon Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Koleksiyon</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Koleksiyon seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCollections.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name} ({c.year.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddCollection} className="w-full">
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-1">
        {userCollections.map((uc) => (
          <div
            key={uc.id}
            className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {uc.collection.name} ({uc.collection.year.year})
              </span>
              {uc.isDefault && (
                <span className="text-xs text-muted-foreground">(Varsayılan)</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!uc.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefault(uc.collectionId)}
                >
                  Varsayılan Yap
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCollection(uc.collectionId)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



