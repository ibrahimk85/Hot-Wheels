'use client';

import { useState, useEffect } from 'react';
import { ReportGenerator } from '@/components/ReportGenerator';
import { ReportCharts } from '@/components/ReportCharts';
import { ReportTable } from '@/components/ReportTable';
import { ExcelExportButton } from '@/components/ExcelExportButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  SummaryReportData,
  CollectionReportData,
  YearReportData,
  ValueReportData,
  MissingModelsReportData,
} from '@/features/reports/report.service';

interface Collection {
  id: number;
  name: string;
  year: {
    year: number;
  };
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    // Fetch collections for Excel export
    fetch('/api/collections')
      .then((res) => res.json())
      .then((data) => setCollections(data))
      .catch((err) => console.error('Failed to fetch collections:', err));
  }, []);

  const handleGenerate = async (type: string, params?: any) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.year) queryParams.set('year', params.year.toString());
      if (params?.collectionId)
        queryParams.set('collectionId', params.collectionId.toString());

      const response = await fetch(
        `/api/reports/generate?type=${type}&${queryParams.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to generate report: ${response.status}`
        );
      }

      const data = await response.json();
      setReportData({ type, data });
      return data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  };

  // Table columns for different report types
  const summaryCollectionsColumns: ColumnDef<SummaryReportData['collections'][0]>[] =
    [
      {
        accessorKey: 'name',
        header: 'Koleksiyon',
      },
      {
        accessorKey: 'year',
        header: 'Yıl',
      },
      {
        accessorKey: 'variantCount',
        header: 'Toplam Varyant',
      },
      {
        accessorKey: 'ownedCount',
        header: 'Sahip Olunan',
      },
    ];

  const summaryYearsColumns: ColumnDef<SummaryReportData['years'][0]>[] = [
    {
      accessorKey: 'year',
      header: 'Yıl',
    },
    {
      accessorKey: 'variantCount',
      header: 'Toplam Varyant',
    },
    {
      accessorKey: 'ownedCount',
      header: 'Sahip Olunan',
    },
  ];

  const collectionModelsColumns: ColumnDef<CollectionReportData['models'][0]>[] =
    [
      {
        accessorKey: 'castingName',
        header: 'Model Adı',
      },
      {
        accessorKey: 'owned',
        header: 'Sahip Olunan',
        cell: ({ row }) => (row.original.owned ? 'Evet' : 'Hayır'),
      },
      {
        accessorKey: 'wishlisted',
        header: 'Wishlist',
        cell: ({ row }) => (row.original.wishlisted ? 'Evet' : 'Hayır'),
      },
      {
        accessorKey: 'variantCount',
        header: 'Varyant Sayısı',
      },
      {
        accessorKey: 'packedPrice',
        header: 'Kartlı Fiyat',
        cell: ({ row }) =>
          row.original.packedPrice
            ? `${row.original.packedPrice.toFixed(2)} TL`
            : '-',
      },
      {
        accessorKey: 'loosePrice',
        header: 'Kutusuz Fiyat',
        cell: ({ row }) =>
          row.original.loosePrice
            ? `${row.original.loosePrice.toFixed(2)} TL`
            : '-',
      },
    ];

  const valueTopModelsColumns: ColumnDef<ValueReportData['topValuableModels'][0]>[] =
    [
      {
        accessorKey: 'castingName',
        header: 'Model Adı',
      },
      {
        accessorKey: 'value',
        header: 'Değer (TL)',
        cell: ({ row }) => row.original.value.toFixed(2),
      },
      {
        accessorKey: 'owned',
        header: 'Sahip Olunan',
        cell: ({ row }) => (row.original.owned ? 'Evet' : 'Hayır'),
      },
    ];

  const missingModelsColumns: ColumnDef<
    MissingModelsReportData['missingModels'][0]
  >[] = [
    {
      accessorKey: 'castingName',
      header: 'Model Adı',
    },
    {
      accessorKey: 'collectionName',
      header: 'Koleksiyon',
    },
    {
      accessorKey: 'subSeriesName',
      header: 'Seri',
    },
    {
      accessorKey: 'year',
      header: 'Yıl',
    },
    {
      accessorKey: 'variantCount',
      header: 'Varyant Sayısı',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h2 className="text-2xl font-semibold">Raporlar</h2>
        </div>
        <ExcelExportButton collections={collections} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReportGenerator onGenerate={handleGenerate} />
        </div>

        <div className="lg:col-span-2">
          {reportData && (
            <Card>
              <CardHeader>
                <CardTitle>Rapor Önizleme</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Özet</TabsTrigger>
                    <TabsTrigger value="charts">Grafikler</TabsTrigger>
                    <TabsTrigger value="tables">Tablolar</TabsTrigger>
                    <TabsTrigger value="export">Export</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4 mt-4">
                    {reportData.type === 'summary' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Toplam Model:</span>{' '}
                          {(reportData.data as SummaryReportData).totalModels}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Varyant:</span>{' '}
                          {(reportData.data as SummaryReportData).totalVariants}
                        </div>
                        <div>
                          <span className="font-semibold">Sahip Olunan:</span>{' '}
                          {(reportData.data as SummaryReportData).ownedVariants}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Değer:</span>{' '}
                          {(
                            reportData.data as SummaryReportData
                          ).totalValue.total.toFixed(2)}{' '}
                          TL
                        </div>
                      </div>
                    )}

                    {reportData.type === 'collection' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Koleksiyon:</span>{' '}
                          {(reportData.data as CollectionReportData).collectionName}
                        </div>
                        <div>
                          <span className="font-semibold">Yıl:</span>{' '}
                          {(reportData.data as CollectionReportData).year}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Model:</span>{' '}
                          {(reportData.data as CollectionReportData).totalModels}
                        </div>
                        <div>
                          <span className="font-semibold">Sahip Olunan:</span>{' '}
                          {(reportData.data as CollectionReportData).ownedModels}
                        </div>
                        <div>
                          <span className="font-semibold">Eksik:</span>{' '}
                          {(reportData.data as CollectionReportData).missingModels}
                        </div>
                      </div>
                    )}

                    {reportData.type === 'year' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Yıl:</span>{' '}
                          {(reportData.data as YearReportData).year}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Model:</span>{' '}
                          {(reportData.data as YearReportData).totalModels}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Varyant:</span>{' '}
                          {(reportData.data as YearReportData).totalVariants}
                        </div>
                        <div>
                          <span className="font-semibold">Toplam Değer:</span>{' '}
                          {(
                            reportData.data as YearReportData
                          ).totalValue.total.toFixed(2)}{' '}
                          TL
                        </div>
                      </div>
                    )}

                    {reportData.type === 'value' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Toplam Değer:</span>{' '}
                          {(
                            reportData.data as ValueReportData
                          ).totalValue.total.toFixed(2)}{' '}
                          TL
                        </div>
                        <div>
                          <span className="font-semibold">Kartlı:</span>{' '}
                          {(
                            reportData.data as ValueReportData
                          ).totalValue.packed.toFixed(2)}{' '}
                          TL
                        </div>
                        <div>
                          <span className="font-semibold">Kutusuz:</span>{' '}
                          {(
                            reportData.data as ValueReportData
                          ).totalValue.loose.toFixed(2)}{' '}
                          TL
                        </div>
                      </div>
                    )}

                    {reportData.type === 'missing' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Eksik Model Sayısı:</span>{' '}
                          {(reportData.data as MissingModelsReportData).totalMissing}
                        </div>
                        {(reportData.data as MissingModelsReportData)
                          .collectionName && (
                          <div>
                            <span className="font-semibold">Koleksiyon:</span>{' '}
                            {
                              (reportData.data as MissingModelsReportData)
                                .collectionName
                            }
                          </div>
                        )}
                        {(reportData.data as MissingModelsReportData).year && (
                          <div>
                            <span className="font-semibold">Yıl:</span>{' '}
                            {(reportData.data as MissingModelsReportData).year}
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="charts" className="mt-4">
                    <ReportCharts
                      reportType={reportData.type}
                      data={reportData.data}
                    />
                  </TabsContent>

                  <TabsContent value="tables" className="mt-4">
                    {reportData.type === 'summary' && (
                      <div className="space-y-6">
                        <ReportTable
                          title="Koleksiyonlar"
                          data={(reportData.data as SummaryReportData).collections}
                          columns={summaryCollectionsColumns}
                          searchKey="name"
                        />
                        <ReportTable
                          title="Yıllar"
                          data={(reportData.data as SummaryReportData).years}
                          columns={summaryYearsColumns}
                          searchKey="year"
                        />
                      </div>
                    )}

                    {reportData.type === 'collection' && (
                      <ReportTable
                        title="Modeller"
                        data={(reportData.data as CollectionReportData).models}
                        columns={collectionModelsColumns}
                        searchKey="castingName"
                      />
                    )}

                    {reportData.type === 'value' && (
                      <ReportTable
                        title="En Değerli Modeller"
                        data={(reportData.data as ValueReportData).topValuableModels}
                        columns={valueTopModelsColumns}
                        searchKey="castingName"
                      />
                    )}

                    {reportData.type === 'missing' && (
                      <ReportTable
                        title="Eksik Modeller"
                        data={
                          (reportData.data as MissingModelsReportData).missingModels
                        }
                        columns={missingModelsColumns}
                        searchKey="castingName"
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="export" className="mt-4">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Export Seçenekleri</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              PDF export için ReportGenerator bileşenindeki "PDF
                              İndir" butonunu kullanabilirsiniz.
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Excel export için sayfanın üstündeki "Excel Export"
                              butonunu kullanabilirsiniz.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
