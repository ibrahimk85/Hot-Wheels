import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollRestore } from '@/components/ScrollRestore';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getSubSeriesById, getSubSeriesCompletionDetails } from '@/features/models/model.service';

type CompletionDetailPageProps = {
  params: Promise<{ subSeriesId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function normalizeImagePath(path: string): string {
  let normalizedPath = path.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  return normalizedPath.replace(/\/+/g, '/');
}

export default async function CompletionDetailPage({ params, searchParams }: CompletionDetailPageProps) {
  const { subSeriesId } = await params;
  const search = await searchParams;

  const id = Number(subSeriesId);
  const yearParam = Array.isArray(search?.year) ? search?.year[0] : search?.year;
  const year = Number(yearParam);

  if (Number.isNaN(id) || Number.isNaN(year)) {
    return <div className="p-4">Gecersiz alt seri veya yil bilgisi.</div>;
  }

  const subSeries = await getSubSeriesById(id);
  if (!subSeries) {
    return <div className="p-4">Alt seri bulunamadi.</div>;
  }

  const detailItems = await getSubSeriesCompletionDetails(id, year);
  const missingItems = detailItems.filter((item) => !item.packedOwned);
  const completedItems = detailItems.filter((item) => item.packedOwned);

  const breadcrumbItems = [
    { label: 'Modeller', href: '/models' },
    { label: `${subSeries.name} (${year})`, href: `/models/completion/${id}?year=${year}` },
  ];

  return (
    <div className="space-y-6">
      <ScrollRestore />
      <Breadcrumb items={breadcrumbItems} />
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{subSeries.name}</h2>
        <div className="text-sm text-muted-foreground">
          {subSeries.collection.name} • {year} • {detailItems.length} varyant
        </div>
      </div>

      {detailItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Bu alt seri/yil icin varyant bulunamadi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Tamamlanmayanlar ({missingItems.length})</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {missingItems.map((item) => (
                <Card key={`missing-${item.variantId}`}>
                  <CardContent className="flex gap-3 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image ? (
                        <Image
                          src={normalizeImagePath(item.image.path)}
                          alt={item.image.alt ?? item.modelName}
                          fill
                          sizes="80px"
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Gorsel yok</div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-semibold">{item.modelName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.releaseName ?? '-'} • Card: {item.cardNumber ?? '-'} • Toy: {item.toyNumber ?? '-'}
                      </div>
                      <Badge variant="secondary">Eksik</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Tamamlananlar ({completedItems.length})</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {completedItems.map((item) => (
                <Card key={`completed-${item.variantId}`}>
                  <CardContent className="flex gap-3 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image ? (
                        <Image
                          src={normalizeImagePath(item.image.path)}
                          alt={item.image.alt ?? item.modelName}
                          fill
                          sizes="80px"
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Gorsel yok</div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-semibold">{item.modelName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.releaseName ?? '-'} • Card: {item.cardNumber ?? '-'} • Toy: {item.toyNumber ?? '-'}
                      </div>
                      <Badge>Packed</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

