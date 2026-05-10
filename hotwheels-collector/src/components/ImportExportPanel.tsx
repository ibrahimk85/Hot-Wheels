'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Year {
  id: number;
  year: number;
}

interface Collection {
  id: number;
  name: string;
  yearId: number;
}

interface SubSeries {
  id: number;
  name: string;
  collectionId: number;
}

interface PreviewData {
  totalRows: number;
  matched: number;
  unmatched: number;
  preview: Array<{
    rowIndex: number;
    importData: any;
    currentData: {
      variant: {
        id: number;
        packedOwned: boolean;
        looseOwned: boolean;
        wishlisted: boolean;
        quantity: number;
        notes: string | null;
        condition: string | null;
      };
      model: {
        id: number;
        packedPurchasePrice: number | null;
        packedMarketPrice: number | null;
        loosePurchasePrice: number | null;
        looseMarketPrice: number | null;
        notes: string | null;
      };
    } | null;
    matchStatus: 'matched' | 'unmatched' | 'error';
    matchMethod?: 'variantId' | 'toyNumber' | 'cardNumber';
    changes: Array<{
      field: string;
      current: any;
      new: any;
      willChange: boolean;
    }>;
  }>;
  errors: Array<{ rowIndex: number; error: string }>;
}

export function ImportExportPanel() {
  // Export state
  const [years, setYears] = useState<Year[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [subSeries, setSubSeries] = useState<SubSeries[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedSubSeries, setSelectedSubSeries] = useState<string>('all');
  const [packedOwnedFilter, setPackedOwnedFilter] = useState<string>('all');
  const [looseOwnedFilter, setLooseOwnedFilter] = useState<string>('all');
  const [wishlistedFilter, setWishlistedFilter] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('excel');
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    updatedVariants?: number;
    updatedModels?: number;
    errors?: Array<{ rowIndex: number; error: string }>;
  } | null>(null);

  // Load years and collections on mount
  useEffect(() => {
    fetch('/api/years')
      .then((res) => res.json())
      .then((data) => {
        setYears(data);
        if (data.length > 0) {
          setSelectedYear(data[0].id.toString());
        }
      })
      .catch(console.error);
  }, []);

  // Load collections when year changes
  useEffect(() => {
    if (!selectedYear) return;

    fetch(`/api/collections?yearId=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => {
        setCollections(data);
        setSelectedCollection('all');
        setSelectedSubSeries('all');
        setSubSeries([]);
      })
      .catch(console.error);
  }, [selectedYear]);

  // Load subSeries when collection changes
  useEffect(() => {
    if (!selectedCollection || selectedCollection === 'all') {
      setSubSeries([]);
      return;
    }

    fetch(`/api/subseries?collectionId=${selectedCollection}`)
      .then((res) => res.json())
      .then((data) => {
        setSubSeries(data);
        setSelectedSubSeries('all');
      })
      .catch(console.error);
  }, [selectedCollection]);

  // Export handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      
      if (selectedYear) {
        params.append('year', selectedYear);
      }
      if (selectedCollection !== 'all') {
        params.append('collectionId', selectedCollection);
      }
      if (selectedSubSeries !== 'all') {
        params.append('subSeriesId', selectedSubSeries);
      }
      if (packedOwnedFilter !== 'all') {
        params.append('packedOwnedStatus', packedOwnedFilter);
      }
      if (looseOwnedFilter !== 'all') {
        params.append('looseOwnedStatus', looseOwnedFilter);
      }
      if (wishlistedFilter !== 'all') {
        params.append('wishlistedStatus', wishlistedFilter);
      }
      params.append('format', exportFormat);

      const response = await fetch(`/api/data-management/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        // More precise regex to extract filename
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          let filename = filenameMatch[1];
          // Remove quotes if present
          filename = filename.replace(/^["']|["']$/g, '');
          // Remove any trailing underscores or dashes
          filename = filename.replace(/[_-]+$/, '');
          a.download = filename;
        } else {
          // Fallback to default if header parsing fails
          a.download = `hotwheels-export-${new Date().toISOString().split('T')[0]}.${exportFormat === 'csv' ? 'csv' : 'xlsx'}`;
        }
      } else {
        // Fallback to default if no header
        a.download = `hotwheels-export-${new Date().toISOString().split('T')[0]}.${exportFormat === 'csv' ? 'csv' : 'xlsx'}`;
      }
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Import file handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setPreviewData(null);
      setImportResult(null);
    }
  };

  // Preview handler
  const handlePreview = async () => {
    if (!importFile) return;

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/data-management/import/preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Preview failed');
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      console.error('Preview error:', error);
      alert(error instanceof Error ? error.message : 'Preview failed. Please check your file format.');
    }
  };

  // Import handler
  const handleImport = async () => {
    if (!previewData) return;

    setImporting(true);
    try {
      const response = await fetch('/api/data-management/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preview: previewData.preview }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      setImportResult(result);
      
      // Refresh page after successful import
      if (result.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  const changesCount = previewData?.preview.filter((row) => 
    row.matchStatus === 'matched' && row.changes.some((c) => c.willChange)
  ).length || 0;

  return (
    <Tabs defaultValue="export" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="export">Export</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
      </TabsList>

      <TabsContent value="export" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Veri Export
            </CardTitle>
            <CardDescription>
              Filtrelenmiş verilerinizi CSV veya Excel formatında export edin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Yıl</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Yıl seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year.id} value={year.id.toString()}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Koleksiyon</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id.toString()}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Alt Seri</Label>
                <Select 
                  value={selectedSubSeries} 
                  onValueChange={setSelectedSubSeries}
                  disabled={selectedCollection === 'all'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {subSeries.map((ss) => (
                      <SelectItem key={ss.id} value={ss.id.toString()}>
                        {ss.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Packed Owned</Label>
                <Select value={packedOwnedFilter} onValueChange={setPackedOwnedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="true">Evet</SelectItem>
                    <SelectItem value="false">Hayır</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loose Owned</Label>
                <Select value={looseOwnedFilter} onValueChange={setLooseOwnedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="true">Evet</SelectItem>
                    <SelectItem value="false">Hayır</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wishlisted</Label>
                <Select value={wishlistedFilter} onValueChange={setWishlistedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="true">Evet</SelectItem>
                    <SelectItem value="false">Hayır</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'excel')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV (.csv)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleExport} 
              disabled={exporting || !selectedYear}
              className="w-full"
            >
              {exporting ? 'Exporting...' : 'Export Et'}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="import" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Veri Import
            </CardTitle>
            <CardDescription>
              Düzenlenmiş Excel veya CSV dosyanızı yükleyin ve import edin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dosya Seç</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
              <p className="text-sm text-muted-foreground">
                CSV veya Excel (.xlsx, .xls) formatında dosya yükleyin
              </p>
            </div>

            {importFile && (
              <div className="flex items-center gap-2">
                <Button onClick={handlePreview} variant="outline">
                  Preview
                </Button>
                <span className="text-sm text-muted-foreground">
                  {importFile.name}
                </span>
              </div>
            )}

            {previewData && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{previewData.totalRows}</div>
                      <div className="text-sm text-muted-foreground">Toplam Satır</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-green-600">{previewData.matched}</div>
                      <div className="text-sm text-muted-foreground">Eşleşen</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-orange-600">{changesCount}</div>
                      <div className="text-sm text-muted-foreground">Değişecek</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Satır</TableHead>
                          <TableHead>Variant ID</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Değişiklikler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.preview.slice(0, 50).map((row) => (
                          <TableRow key={row.rowIndex}>
                            <TableCell>{row.rowIndex}</TableCell>
                            <TableCell>
                              {row.currentData?.variant.id || '-'}
                            </TableCell>
                            <TableCell>
                              {row.matchStatus === 'matched' ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Eşleşti</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-red-600">
                                  <XCircle className="h-4 w-4" />
                                  <span>Eşleşmedi</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.changes.length > 0 ? (
                                <div className="space-y-1">
                                  {row.changes.map((change, idx) => (
                                    <div key={idx} className="text-xs">
                                      <span className="font-medium">{change.field}:</span>{' '}
                                      <span className="text-muted-foreground">
                                        {String(change.current)} → {String(change.new)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Değişiklik yok</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {previewData.preview.length > 50 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      ... ve {previewData.preview.length - 50} satır daha
                    </div>
                  )}
                </div>

                {previewData.unmatched > 0 && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      {previewData.unmatched} satır eşleşmedi ve atlanacak
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={importing || changesCount === 0}
                  className="w-full"
                >
                  {importing ? 'Importing...' : `Import Et (${changesCount} değişiklik)`}
                </Button>
              </div>
            )}

            {importResult && (
              <div className={`p-4 rounded-lg ${
                importResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">
                      {importResult.success ? 'Import Başarılı' : 'Import Başarısız'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {importResult.message}
                    </div>
                    {importResult.updatedVariants !== undefined && (
                      <div className="text-sm">
                        {importResult.updatedVariants} variant ve {importResult.updatedModels} model güncellendi
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

