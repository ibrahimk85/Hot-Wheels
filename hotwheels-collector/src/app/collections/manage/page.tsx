'use client';

import { useState, useEffect } from 'react';
import { MultiCollectionSelector } from '@/components/MultiCollectionSelector';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManageCollectionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    // LocalStorage'dan kullanıcı ID'sini al
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(parseInt(storedUserId));
    } else {
      // Kullanıcı giriş yapmamış, login sayfasına yönlendir
      router.push('/auth/login');
    }
  }, [router]);

  const handleExport = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/collections/sync?userId=${userId}`);
      const data = await response.json();

      // JSON dosyası olarak indir
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collection-backup-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export hatası:', error);
      alert('Yedekleme sırasında bir hata oluştu');
    }
  };

  const handleImport = () => {
    // Import özelliği gelecek güncellemelerde eklenecek
    alert('Import özelliği yakında eklenecek');
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Koleksiyon Yönetimi</h2>
          <p className="text-muted-foreground">
            Koleksiyonlarınızı yönetin, ekleyin veya kaldırın
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Yedekle
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            İçe Aktar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Koleksiyonlarım</CardTitle>
          <CardDescription>
            Sahip olduğunuz koleksiyonları görüntüleyin ve yönetin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiCollectionSelector
            userId={userId}
            onCollectionChange={(collectionId) => {
              console.log('Seçilen koleksiyon:', collectionId);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}



