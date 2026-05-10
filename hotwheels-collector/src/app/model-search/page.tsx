import prisma from '@/db';
import { getModelsWithMissingImages, getModelsWithMissingImagesCount } from '@/features/models/model.service';
import { ModelFilters } from '@/features/models/model.service';
import ModelSearchFilterForm from './model-search-filter-form';
import { Pagination } from '@/components/Pagination';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { ImageSearchDialog } from '@/components/ImageSearchDialog';
import { ModelSearchCard } from './ModelSearchCard';

type ModelSearchPageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ModelSearchPage({ searchParams }: ModelSearchPageProps) {
  const params = await searchParams;

  const qParam = params?.q;
  const ownedParam = params?.owned;
  const wishParam = params?.wish as string | undefined;
  const yearParam = params?.year as string | undefined;
  const collectionParam = params?.collection as string | undefined;
  const subSeriesParam = params?.subSeries as string | undefined;
  const pageParam = params?.page as string | undefined;

  const currentPage = Math.max(1, Number(pageParam) || 1);
  const pageSize = 36;
  const offset = (currentPage - 1) * pageSize;

  const search =
    typeof qParam === 'string' && qParam.trim().length > 0 ? qParam.trim() : undefined;

  let ownedStatus: boolean | undefined;
  if (ownedParam === '1') ownedStatus = true;
  if (ownedParam === '0') ownedStatus = false;

  let wishlistedStatus: boolean | undefined;
  if (wishParam === '1') wishlistedStatus = true;
  if (wishParam === '0') wishlistedStatus = false;

  const selectedYear = yearParam ? Number(yearParam) : 2025;
  const collectionId = collectionParam ? Number(collectionParam) : undefined;
  const subSeriesId = subSeriesParam ? Number(subSeriesParam) : undefined;

  // Get collection name if collectionId is set
  const selectedCollectionData = collectionId
    ? await prisma.collection.findUnique({
        where: { id: collectionId },
        select: { name: true },
      })
    : null;

  const [years, collectionsForYear, subSeriesForCollection, models, totalCount] = await Promise.all([
    prisma.year.findMany({
      orderBy: { year: 'desc' },
    }),
    prisma.collection.findMany({
      where: selectedYear
        ? {
            year: {
              year: selectedYear,
            },
          }
        : {},
      orderBy: { name: 'asc' },
    }),
    collectionId && selectedCollectionData
      ? selectedCollectionData.name === 'Boulevard'
        ? prisma.subSeries.findMany({
            where: {
              collectionId: collectionId,
              name: {
                in: ['Mix 1', 'Mix 2', 'Mix 3', 'Mix 4', 'Mix 5'],
              },
            },
            orderBy: { name: 'asc' },
          })
        : prisma.subSeries.findMany({
            where: {
              collectionId: collectionId,
            },
            orderBy: { name: 'asc' },
          })
      : Promise.resolve([]),
    getModelsWithMissingImages({
      year: selectedYear,
      search,
      ownedStatus,
      wishlistedStatus,
      collectionName: selectedCollectionData?.name,
      subSeriesId,
      limit: pageSize,
      offset,
    }),
    getModelsWithMissingImagesCount({
      year: selectedYear,
      search,
      ownedStatus,
      wishlistedStatus,
      collectionName: selectedCollectionData?.name,
      subSeriesId,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Model Arama - Görselleri Eksik Modeller</h2>

      <ModelSearchFilterForm
        years={years}
        collectionsForYear={collectionsForYear}
        subSeriesForCollection={subSeriesForCollection}
        selectedYear={selectedYear}
        collectionId={collectionId}
        subSeriesId={subSeriesId}
        search={search}
        ownedStatus={ownedStatus}
        wishlistedStatus={wishlistedStatus}
      />

      {/* Pagination - Top */}
      {totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          selectedYear={selectedYear}
          search={search}
          ownedStatus={ownedStatus}
          wishlistedStatus={wishlistedStatus}
          collectionId={collectionId}
          subSeriesId={subSeriesId}
          basePath="/model-search"
        />
      )}

      {/* Model listesi */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {models.map((model) => (
          <ModelSearchCard key={model.id} model={model} />
        ))}
      </div>

      {models.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Görselleri eksik model bulunamadı.
          </CardContent>
        </Card>
      )}

      {/* Pagination - Bottom */}
      {totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          selectedYear={selectedYear}
          search={search}
          ownedStatus={ownedStatus}
          wishlistedStatus={wishlistedStatus}
          collectionId={collectionId}
          subSeriesId={subSeriesId}
          basePath="/model-search"
        />
      )}
    </div>
  );
}

