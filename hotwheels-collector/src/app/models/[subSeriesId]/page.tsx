import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollRestore } from '@/components/ScrollRestore';
import { Breadcrumb } from '@/components/Breadcrumb';
import { InfoStats } from '@/components/InfoStats';
import { ModelLink } from '@/components/ModelLink';
import { getModelsBySubSeries } from '@/features/models/model.service';
import {
  collectionUsesVariantLevelPreviewImages,
  getModelCardVariantLevelCandidates,
  pickFirstVariantPreviewAmong,
} from '@/lib/variant-preview-image';
import { WikiAwareHotWheelsImage } from '@/components/WikiAwareHotWheelsImage';
import prisma from '@/db';

type SubSeriesPageProps = {
  params: Promise<{ subSeriesId: string }>;
};

export default async function SubSeriesPage({ params }: SubSeriesPageProps) {
  const { subSeriesId } = await params;
  const id = Number(subSeriesId);

  if (Number.isNaN(id)) {
    return <div className="p-4">Geçersiz alt seri ID.</div>;
  }

  const subSeries = await prisma.subSeries.findUnique({
    where: { id },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
  });

  if (!subSeries) {
    return <div className="p-4">Alt seri bulunamadı.</div>;
  }

  const models = await getModelsBySubSeries(id);
  const collection = subSeries.collection;
  const isTeamTransport = collection?.name === 'Team Transport';

  const breadcrumbItems = [
    { label: 'Modeller', href: '/models' },
    { label: subSeries.name, href: `/models/${id}` },
  ];

  // For Team Transport: Create expanded model cards (transport, car, main)
  // For other collections: Use models as-is
  let displayItems: Array<{
    id: string;
    castingName: string;
    image: { id: number; path: string; alt: string | null } | null;
    /** Set for Boulevard / F&F Premium / … — client skips Fandom placeholder JPEGs by decoded size */
    variantLevelCandidates?: Array<{ id: number; path: string; alt: string | null }>;
    href: string;
    collection: typeof collection | null;
    subSeries: typeof subSeries | null;
    variantCount?: number;
    type?: 'transport' | 'car' | 'main';
  }> = [];

  if (isTeamTransport) {
    // Process each Model Araba to create 3 types of cards
    for (const model of models) {
      if (!model.variants || model.variants.length === 0) {
        // If no variants, just show the main model
        const mainImage = model.mainImageId
          ? model.images?.find((img) => img.id === model.mainImageId) || model.images?.[0]
          : model.images?.[0];
        displayItems.push({
          id: `main-${model.id}`,
          castingName: model.castingName,
          image: mainImage || null,
          href: `/model/${model.id}`,
          collection: model.subSeries?.collection || null,
          subSeries: model.subSeries || null,
          variantCount: model._count.variants,
          type: 'main',
        });
        continue;
      }

      // Find transport variant (releaseName contains "Transport")
      const transportVariant = model.variants.find(
        (v) => v.releaseName && v.releaseName.toLowerCase().includes('transport')
      );

      // Find car variants (releaseName does NOT contain "Transport")
      const carVariants = model.variants.filter(
        (v) => !v.releaseName || !v.releaseName.toLowerCase().includes('transport')
      );

      // 1. Transport Model Card
      if (transportVariant) {
        const transportLooseImage = transportVariant.images?.find((img) => {
          const path = img.path.toLowerCase();
          return path.includes('loose-') || path.includes('_loose') || path.includes('/loose');
        });
        displayItems.push({
          id: `transport-${transportVariant.id}`,
          castingName: transportVariant.releaseName || transportVariant.color || 'Transport',
          image: transportLooseImage || transportVariant.images?.[0] || null,
          href: `/variant/${transportVariant.id}`,
          collection: model.subSeries?.collection || null,
          subSeries: model.subSeries || null,
          type: 'transport',
        });
      }

      // 2. Car Model Cards (one for each car variant)
      for (const carVariant of carVariants) {
        const carLooseImage = carVariant.images?.find((img) => {
          const path = img.path.toLowerCase();
          return path.includes('loose-') || path.includes('_loose') || path.includes('/loose');
        });
        displayItems.push({
          id: `car-${carVariant.id}`,
          castingName: carVariant.releaseName || carVariant.color || 'Car',
          image: carLooseImage || carVariant.images?.[0] || null,
          href: `/variant/${carVariant.id}`,
          collection: model.subSeries?.collection || null,
          subSeries: model.subSeries || null,
          type: 'car',
        });
      }

      // 3. Main Model Card (Photo Carded)
      const mainImage = model.mainImageId
        ? model.images?.find((img) => img.id === model.mainImageId)
        : model.images?.find((img) => {
            const path = img.path.toLowerCase();
            return path.includes('carded-') || path.includes('_carded') || path.includes('/carded');
          }) || model.images?.[0];
      displayItems.push({
        id: `main-${model.id}`,
        castingName: model.castingName,
        image: mainImage || null,
        href: `/model/${model.id}`,
        collection: model.subSeries?.collection || null,
        subSeries: model.subSeries || null,
        variantCount: model._count.variants,
        type: 'main',
      });
    }
  } else {
    // For other collections: Use models as-is
    displayItems = models.map((model) => {
      const coll = model.subSeries?.collection;
      const cn = coll?.name ?? null;
      const useVar = collectionUsesVariantLevelPreviewImages(cn);
      const img = useVar
        ? null
        : pickFirstVariantPreviewAmong(cn, model.variants ?? []) || null;
      const variantLevelCandidates = useVar
        ? getModelCardVariantLevelCandidates(cn, model.variants ?? [], model.images ?? [])
        : undefined;
      return {
        id: `model-${model.id}`,
        castingName: model.castingName,
        image: img,
        variantLevelCandidates,
        href: `/model/${model.id}`,
        collection: model.subSeries?.collection || null,
        subSeries: model.subSeries || null,
        variantCount: model._count.variants,
      };
    });
  }

  // Get unique years from display items
  const uniqueYears = new Set<number>();
  displayItems.forEach((item) => {
    if (item.collection?.year?.year) {
      uniqueYears.add(item.collection.year.year);
    }
  });
  const totalYears = uniqueYears.size;
  const totalModels = displayItems.length;

  const stats = [
    { label: 'Yıl', value: totalYears },
    { label: 'Model', value: totalModels },
  ];

  return (
    <div className="space-y-6">
      <ScrollRestore />
      <Breadcrumb items={breadcrumbItems} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-semibold">{subSeries.name}</h2>
        <InfoStats items={stats} />
      </div>
      {displayItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Bu alt seri için model bulunmamaktadır.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayItems.map((item) => {
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <ModelLink href={item.href}>
                  <CardContent className="p-4 flex flex-col gap-2">
                    {item.variantLevelCandidates !== undefined ? (
                      <WikiAwareHotWheelsImage
                        candidates={item.variantLevelCandidates}
                        altFallback={item.castingName}
                      />
                    ) : item.image?.path ? (
                      <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                        <Image
                          src={(() => {
                            let normalizedPath = item.image.path.replace(/\\/g, '/');
                            if (!normalizedPath.startsWith('/')) {
                              normalizedPath = '/' + normalizedPath;
                            }
                            normalizedPath = normalizedPath.replace(/\/+/g, '/');
                            return normalizedPath;
                          })()}
                          alt={item.image.alt ?? item.castingName}
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
                      <div className="font-semibold text-sm">{item.castingName}</div>
                      {item.collection && (
                        <div className="text-xs text-muted-foreground">
                          {item.collection.year.year} – {item.collection.name}
                          {item.subSeries && ` • ${item.subSeries.name}`}
                        </div>
                      )}
                      {item.variantCount !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          {item.variantCount} varyant
                        </div>
                      )}
                      {isTeamTransport && item.type && (
                        <div className="text-xs text-muted-foreground">
                          {item.type === 'transport' && 'Transport'}
                          {item.type === 'car' && 'Car'}
                          {item.type === 'main' && 'Ana Model'}
                        </div>
                      )}
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
