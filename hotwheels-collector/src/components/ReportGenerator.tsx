'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { exportReportToPDF } from '@/features/reports/pdf-export.service';
import type {
  SummaryReportData,
  CollectionReportData,
  YearReportData,
  ValueReportData,
  MissingModelsReportData,
} from '@/features/reports/report.service';

interface ReportGeneratorProps {
  onGenerate: (type: string, params?: any) => Promise<any>;
}

interface Collection {
  id: number;
  name: string;
  year: {
    year: number;
  };
}

export function ReportGenerator({ onGenerate }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState<string>('summary');
  const [year, setYear] = useState<string>('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [pdfTemplate, setPdfTemplate] = useState<'executive' | 'detailed'>('detailed');

  // Collections'ı fetch et
  useEffect(() => {
    if (reportType === 'collection' || reportType === 'missing') {
      fetch('/api/collections')
        .then((res) => res.json())
        .then((data) => setCollections(data))
        .catch((err) => console.error('Failed to fetch collections:', err));
    }
  }, [reportType]);

  // Yıl değiştiğinde seçili koleksiyon'ı sıfırla (yanlış yıldan olabilir)
  useEffect(() => {
    if (year) {
      setCollectionId('');
    }
  }, [year]);

  const handleGenerate = async () => {
    // Validation
    if (reportType === 'collection' && !collectionId) {
      alert('Lütfen bir koleksiyon seçin.');
      return;
    }
    if (reportType === 'year' && !year) {
      alert('Lütfen bir yıl girin.');
      return;
    }

    setLoading(true);
    try {
      const params: any = {};
      if (year) params.year = Number(year);
      if (collectionId) params.collectionId = Number(collectionId);

      const data = await onGenerate(reportType, params);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Rapor oluşturulurken bir hata oluştu.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    try {
      const pdfDoc = exportReportToPDF(
        reportType as any,
        reportData,
        { template: pdfTemplate }
      );
      pdfDoc.save(`hotwheels-rapor-${reportType}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('PDF export sırasında bir hata oluştu.');
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'summary':
        return 'Genel Özet';
      case 'collection':
        return 'Koleksiyon Raporu';
      case 'year':
        return 'Yıl Raporu';
      case 'value':
        return 'Değer Analizi';
      case 'missing':
        return 'Eksik Modeller';
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapor Oluştur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Rapor Tipi</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Genel Özet</SelectItem>
              <SelectItem value="collection">Koleksiyon Raporu</SelectItem>
              <SelectItem value="year">Yıl Raporu</SelectItem>
              <SelectItem value="value">Değer Analizi</SelectItem>
              <SelectItem value="missing">Eksik Modeller</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {reportType === 'year' && (
          <div className="space-y-2">
            <Label>Yıl (Zorunlu)</Label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            />
          </div>
        )}

        {reportType === 'missing' && (
          <div className="space-y-2">
            <Label>Yıl (Opsiyonel)</Label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            />
          </div>
        )}

        {reportType === 'missing' && (
          <div className="space-y-2">
            <Label>Koleksiyon (Opsiyonel)</Label>
            <Select
              value={collectionId || 'all'}
              onValueChange={(value) => setCollectionId(value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm koleksiyonlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm koleksiyonlar</SelectItem>
                {(year
                  ? collections.filter((c) => c.year.year === Number(year))
                  : collections
                ).map((collection) => (
                  <SelectItem
                    key={collection.id}
                    value={collection.id.toString()}
                  >
                    {collection.name} ({collection.year.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {reportType === 'collection' && (
          <div className="space-y-2">
            <Label>Koleksiyon (Zorunlu)</Label>
            <Select
              value={collectionId}
              onValueChange={setCollectionId}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Koleksiyon seçin..." />
              </SelectTrigger>
              <SelectContent>
                {(year
                  ? collections.filter((c) => c.year.year === Number(year))
                  : collections
                ).map((collection) => (
                  <SelectItem
                    key={collection.id}
                    value={collection.id.toString()}
                  >
                    {collection.name} ({collection.year.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? 'Oluşturuluyor...' : 'Rapor Oluştur'}
        </Button>

        {reportData && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rapor Hazır</span>
              <Button onClick={handleExportPDF} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                PDF İndir
              </Button>
            </div>
            <div className="space-y-2">
              <Label>PDF Şablonu</Label>
              <Select
                value={pdfTemplate}
                onValueChange={(value: 'executive' | 'detailed') =>
                  setPdfTemplate(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive (Özet)</SelectItem>
                  <SelectItem value="detailed">Detailed (Detaylı)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

