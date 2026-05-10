import { DataValidationPanel } from '@/components/DataValidationPanel';
import { DuplicateDetector } from '@/components/DuplicateDetector';
import { ImportExportPanel } from '@/components/ImportExportPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, Shield, Merge, Download } from 'lucide-react';

export default function DataManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Veri Yönetimi</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import / Export
          </CardTitle>
          <CardDescription>
            Verilerinizi export edin, düzenleyin ve tekrar import edin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportExportPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Veri Doğrulama
          </CardTitle>
          <CardDescription>
            Koleksiyon verilerinizin tutarlılığını kontrol edin ve sorunları tespit edin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataValidationPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Duplicate Detection
          </CardTitle>
          <CardDescription>
            Tekrarlanan modelleri ve variant'ları tespit edin ve birleştirin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DuplicateDetector />
        </CardContent>
      </Card>
    </div>
  );
}



