import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportImportDialog } from '@/components/ExportImportDialog';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Database, Plug } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Ayarlar</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Veri Yönetimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Export / Import</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Koleksiyon verilerinizi JSON, CSV veya Excel formatında export edebilir veya import edebilirsiniz.
                </p>
                <ExportImportDialog />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              API Entegrasyonları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Harici Servisler</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  eBay, Google Lens ve diğer API entegrasyonlarını yönetin.
                </p>
                <Link href="/settings/integrations">
                  <Button variant="outline" className="w-full">
                    Entegrasyonları Yönet
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

