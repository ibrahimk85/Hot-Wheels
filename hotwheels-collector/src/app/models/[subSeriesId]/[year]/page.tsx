import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollRestore } from '@/components/ScrollRestore';
import { Breadcrumb } from '@/components/Breadcrumb';
import { InfoStats } from '@/components/InfoStats';
import { ModelLink } from '@/components/ModelLink';
import { getModelsBySubSeriesAndYear, getSubSeriesById } from '@/features/models/model.service';
import {
  collectionUsesVariantLevelPreviewImages,
  getModelCardVariantLevelCandidates,
  pickFirstVariantPreviewAmong,
} from '@/lib/variant-preview-image';
import { WikiAwareHotWheelsImage } from '@/components/WikiAwareHotWheelsImage';

type ModelsByYearPageProps = {
  params: Promise<{ subSeriesId: string; year: string }>;
};

export default async function ModelsByYearPage({ params }: ModelsByYearPageProps) {
  const { subSeriesId, year } = await params;
  const subSeriesIdNum = Number(subSeriesId);
  const yearNum = Number(year);

  if (Number.isNaN(subSeriesIdNum) || Number.isNaN(yearNum)) {
    return <div className="p-4">Geçersiz parametreler.</div>;
  }

  const subSeries = await getSubSeriesById(subSeriesIdNum);
  const models = await getModelsBySubSeriesAndYear(subSeriesIdNum, yearNum);

  if (!subSeries) {
    return <div className="p-4">Alt seri bulunamadı.</div>;
  }

  const breadcrumbItems = [
    { label: 'Modeller', href: '/models' },
    { label: subSeries.name, href: `/models/${subSeriesIdNum}` },
    { label: year, href: `/models/${subSeriesIdNum}/${yearNum}` },
  ];

  const stats = [
    { label: 'Model', value: models.length },
  ];

  return (
    <div className="space-y-6">
      <ScrollRestore />
      <Breadcrumb items={breadcrumbItems} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-semibold">
          {subSeries.name} - {year}
        </h2>
        <InfoStats items={stats} />
      </div>
      {models.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Bu alt seri ve yıl için model bulunmamaktadır.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {models.map((model) => {
            const collection = model.subSeries?.collection;
            const cn = collection?.name ?? null;
            const useVar = collectionUsesVariantLevelPreviewImages(cn);
            const variantLevelCandidates = useVar
              ? getModelCardVariantLevelCandidates(cn, model.variants ?? [], model.images ?? [])
              : undefined;
            const img = useVar
              ? null
              : pickFirstVariantPreviewAmong(cn, model.variants ?? []);
            return (
              <Card key={model.id} className="hover:shadow-md transition-shadow">
                <ModelLink href={`/model/${model.id}`}>
                  <CardContent className="p-4 flex flex-col gap-2">
                    {variantLevelCandidates !== undefined ? (
                      <WikiAwareHotWheelsImage
                        candidates={variantLevelCandidates}
                        altFallback={model.castingName}
                      />
                    ) : img?.path ? (
                      <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                        <Image
                          src={(() => {
                            let normalizedPath = img.path.replace(/\\/g, '/');
                            if (!normalizedPath.startsWith('/')) {
                              normalizedPath = '/' + normalizedPath;
                            }
                            normalizedPath = normalizedPath.replace(/\/+/g, '/');
                            return normalizedPath;
                          })()}
                          alt={img.alt ?? model.castingName}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                        Görsel yok
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">{model.castingName}</div>
                      {collection && (
                        <div className="text-xs text-muted-foreground">
                          {collection.year.year} – {collection.name}
                          {model.subSeries && ` • ${model.subSeries.name}`}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {model._count.variants} varyant
                      </div>
                    </div>
                  </CardContent>
                </ModelLink>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

