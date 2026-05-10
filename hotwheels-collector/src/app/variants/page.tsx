// app/variants/page.tsx

import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/db';
import { revalidatePath } from 'next/cache';
import { getVariants, getVariantsCount } from '@/features/variants/variant.service';
import { deleteModel } from '@/features/models/model.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import VariantsFilterForm from './variants-filter-form';
import { Pagination } from '@/components/Pagination';
import { VariantCard } from '@/components/VariantCard';
import { AdvancedFiltersWrapper } from '@/components/AdvancedFiltersWrapper';
import { getAllSavedFilters } from '@/features/filters/filter.service';

type VariantsPageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Packed Owned için inline toggle
async function togglePackedOwnedInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentPackedOwnedRaw = formData.get('currentPackedOwned');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentPackedOwned = currentPackedOwnedRaw === 'true';
  const newPackedOwnedStatus = !currentPackedOwned;

  // Variant'ı güncelle
  await prisma.variant.update({
    where: { id },
    data: { packedOwned: newPackedOwnedStatus },
  });

  revalidatePath('/variants');
  revalidatePath('/collections', 'layout');
  revalidatePath('/', 'layout');
}

// Loose Owned için inline toggle
async function toggleLooseOwnedInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentLooseOwnedRaw = formData.get('currentLooseOwned');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentLooseOwned = currentLooseOwnedRaw === 'true';
  const newLooseOwnedStatus = !currentLooseOwned;

  // Variant'ı güncelle
  await prisma.variant.update({
    where: { id },
    data: { looseOwned: newLooseOwnedStatus },
  });

  revalidatePath('/variants');
  revalidatePath('/collections', 'layout');
  revalidatePath('/', 'layout');
}

// Wish için inline toggle
async function toggleWishInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentWishRaw = formData.get('currentWish');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentWish = currentWishRaw === 'true';
  const newWishStatus = !currentWish;

  // Variant'ı güncelle ve model bilgisini al
  const variant = await prisma.variant.update({
    where: { id },
    data: { wishlisted: newWishStatus },
    include: { model: true },
  });

  // Model seviyesinde güncelleme: Eğer variant wishlisted ise model de wishlisted olsun
  // Eğer variant wishlisted değilse, model'in diğer variant'larına bak
  if (newWishStatus) {
    // Variant wishlisted ise, model'i de wishlisted yap
    await prisma.model.update({
      where: { id: variant.modelId },
      data: { wishlisted: true },
    });
  } else {
    // Variant wishlisted değilse, model'in başka wishlisted variant'ı var mı kontrol et
    const wishlistedVariantsCount = await prisma.variant.count({
      where: {
        modelId: variant.modelId,
        wishlisted: true,
      },
    });

    // Eğer başka wishlisted variant yoksa, model'i de wishlisted olmaktan çıkar
    if (wishlistedVariantsCount === 0) {
      await prisma.model.update({
        where: { id: variant.modelId },
        data: { wishlisted: false },
      });
    }
  }

  revalidatePath('/variants');
  revalidatePath('/collections', 'layout');
  revalidatePath('/', 'layout');
}

// Quantity güncelleme
async function updateQuantityInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const quantityRaw = formData.get('quantity');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const qty = Number(quantityRaw);
  if (Number.isNaN(qty) || qty < 0) return;

  await prisma.variant.update({
    where: { id },
    data: { quantity: qty },
  });

  revalidatePath('/variants');
}

// Model silme
async function deleteModelAction(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const id = Number(idRaw);
  
  if (Number.isNaN(id) || id <= 0) {
    return;
  }

  await deleteModel(id);
  
  revalidatePath('/collections', 'layout');
  revalidatePath('/variants');
  revalidatePath('/', 'layout');
}

export default async function VariantsPage({ searchParams }: VariantsPageProps) {
  const params = await searchParams;

  const qParam = params?.q;
  const thParam = params?.th;
  const sthParam = params?.sth;
  const packedOwnedParam = params?.packedOwned;
  const looseOwnedParam = params?.looseOwned;
  const wishParam = params?.wish as string | undefined;
  const yearParam = params?.year as string | undefined;
  const collectionParam = params?.collection as string | undefined;
  const categoryParam = params?.category as string | undefined;
  const subSeriesParam = params?.subSeries as string | undefined;
  const pageParam = params?.page as string | undefined;

  const currentPage = Math.max(1, Number(pageParam) || 1);
  const pageSize = 36;
  const offset = (currentPage - 1) * pageSize;

  const search =
    typeof qParam === 'string' && qParam.trim().length > 0 ? qParam.trim() : undefined;

  const onlyTH = thParam === '1';
  const onlySTH = sthParam === '1';

  let packedOwnedStatus: boolean | undefined;
  if (packedOwnedParam === '1') packedOwnedStatus = true;
  if (packedOwnedParam === '0') packedOwnedStatus = false;

  let looseOwnedStatus: boolean | undefined;
  if (looseOwnedParam === '1') looseOwnedStatus = true;
  if (looseOwnedParam === '0') looseOwnedStatus = false;

  let wishlistedStatus: boolean | undefined;
  if (wishParam === '1') wishlistedStatus = true;
  if (wishParam === '0') wishlistedStatus = false;

  const selectedYear = yearParam && yearParam !== "all" ? Number(yearParam) : undefined;
  const collectionName = collectionParam && collectionParam !== "all" ? collectionParam : undefined;
  const isSilverSeries = collectionName === 'Hot Wheels Silver Series';
  const subSeriesId = subSeriesParam && !isSilverSeries && /^\d+$/.test(subSeriesParam)
    ? Number(subSeriesParam)
    : undefined;
  const subSeriesName = isSilverSeries && subSeriesParam && subSeriesParam !== "all"
    ? subSeriesParam
    : undefined;

  // Gelişmiş filtreler
  const minPrice = params?.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params?.maxPrice ? Number(params.maxPrice) : undefined;
  const priceType = params?.priceType as 'packed' | 'loose' | undefined;
  const hasImage = params?.hasImage === 'true';
  const hasNotes = params?.hasNotes === 'true';

  // Get collection data if collectionName is set (to check if it's Boulevard and get subSeries)
  // Eğer hem collectionName hem year varsa, o yıla ait koleksiyonu bul
  const selectedCollectionData = collectionName
    ? await prisma.collection.findFirst({
        where: {
          name: collectionName,
          ...(selectedYear ? {
            year: {
              year: selectedYear,
            },
          } : {}),
        },
        select: { id: true, name: true, yearId: true },
      })
    : null;

  const actualCollectionId = selectedCollectionData?.id;

  const [years, collectionsForYear, subSeriesForCollection, variants, totalCount, savedFilters] = await Promise.all([
    // Yılları getir: Akıllı filtreleme
    // - Koleksiyon seçiliyse: O koleksiyonun olduğu yılları göster
    // - Koleksiyon seçili değilse: Tüm yılları göster (9999 hariç)
    (async () => {
      if (collectionName) {
        // Koleksiyon seçiliyse: O koleksiyonun olduğu yılları getir
        const collectionsWithName = await prisma.collection.findMany({
          where: {
            name: collectionName,
          },
          include: {
            year: true,
          },
          distinct: ['yearId'],
        });
        
        // Bu koleksiyonun olduğu yılları getir
        const yearIds = collectionsWithName.map(c => c.yearId);
        const yearsForCollection = await prisma.year.findMany({
          where: {
            id: { in: yearIds },
            year: {
              not: 9999,
            },
          },
          orderBy: { year: 'desc' },
        });
        
        return yearsForCollection;
      } else {
        // Koleksiyon seçili değilse: Tüm yılları getir (9999 hariç)
        return prisma.year.findMany({
          where: {
            year: {
              not: 9999
            }
          },
          orderBy: { year: 'desc' },
        });
      }
    })(),
    // Koleksiyonları getir: Akıllı filtreleme
    // - Yıl seçiliyse: O yıla ait koleksiyonları göster
    // - Yıl seçili değilse: Tüm benzersiz koleksiyon isimlerini göster
    (async () => {
      if (selectedYear) {
        // Yıl seçiliyse: O yıla ait koleksiyonları getir
        const collections = await prisma.collection.findMany({
          where: {
            year: {
              year: selectedYear,
            },
          },
          orderBy: { name: 'asc' },
        });
        
        return collections.map(c => ({ id: c.id, name: c.name }));
      } else {
        // Yıl seçili değilse: Tüm benzersiz koleksiyon isimlerini getir
        const uniqueCollectionNames = await prisma.collection.findMany({
          select: {
            name: true,
          },
          distinct: ['name'],
          orderBy: { name: 'asc' },
        });
        
        // Benzersiz isimleri { id: name, name: name } formatında döndür
        // (id olarak name kullanıyoruz çünkü dropdown'da name ile çalışacağız)
        return uniqueCollectionNames.map(c => ({ id: c.name, name: c.name }));
      }
    })(),
    // Fetch subSeries for selected collection
    // Silver Series: two-level (Anniversary → Purple/Blue and Gold)
    // Boulevard: Mix 1-5
    // Others: by collectionId
    (async () => {
      if (!selectedCollectionData) return [];
      if (selectedCollectionData.name === 'Hot Wheels Silver Series') {
        const allSilverSubSeries = await prisma.subSeries.findMany({
          where: {
            collection: { name: 'Hot Wheels Silver Series' },
          },
          select: { id: true, name: true, category: true },
          orderBy: { name: 'asc' },
        });
        return allSilverSubSeries;
      }
      if (actualCollectionId && selectedCollectionData.name === 'Boulevard') {
        return prisma.subSeries.findMany({
          where: {
            collectionId: actualCollectionId,
            name: { in: ['Mix 1', 'Mix 2', 'Mix 3', 'Mix 4', 'Mix 5'] },
          },
          orderBy: { name: 'asc' },
        });
      }
      if (actualCollectionId) {
        return prisma.subSeries.findMany({
          where: { collectionId: actualCollectionId },
          orderBy: { name: 'asc' },
        });
      }
      return [];
    })(),
    getVariants({
      year: selectedYear,
      search,
      onlyTH,
      onlySTH,
      packedOwnedStatus,
      looseOwnedStatus,
      wishlistedStatus,
      collectionName: collectionName,
      collectionId: actualCollectionId,
      subSeriesId,
      category: isSilverSeries ? categoryParam : undefined,
      subSeriesName: subSeriesName,
      minPrice,
      maxPrice,
      priceType,
      hasImage,
      hasNotes,
      limit: pageSize,
      offset,
    }),
    getVariantsCount({
      year: selectedYear,
      search,
      onlyTH,
      onlySTH,
      packedOwnedStatus,
      looseOwnedStatus,
      wishlistedStatus,
      collectionName: collectionName,
      collectionId: actualCollectionId,
      subSeriesId,
      category: isSilverSeries ? categoryParam : undefined,
      subSeriesName: subSeriesName,
      minPrice,
      maxPrice,
      priceType,
      hasImage,
      hasNotes,
    }),
    getAllSavedFilters('variants'),
  ]);

  // Silver Series: build categories and series list from raw subSeries
  let categoriesForCollection: Array<{ id: string; name: string }> = [];
  let processedSubSeriesForCollection: Array<{ id: number; name: string }> = [];
  if (collectionName === 'Hot Wheels Silver Series' && Array.isArray(subSeriesForCollection)) {
    const silverSubSeries = subSeriesForCollection as Array<{ id: number; name: string; category?: string | null }>;
    categoriesForCollection = [
      { id: 'Anniversary', name: 'Anniversary' },
      { id: 'Automotive', name: 'Automotive' },
      { id: 'Celebrations', name: 'Celebrations' },
      { id: 'Entertainment', name: 'Entertainment' },
      { id: 'Seasonal', name: 'Seasonal' },
      { id: 'Vintage', name: 'Vintage' },
    ];
    const filteredByCategory = categoryParam
      ? silverSubSeries.filter(ss => ss.category === categoryParam)
      : silverSubSeries;
    const seriesNameMap = new Map<string, string>();
    (filteredByCategory as Array<{ id: number; name: string }>).forEach(ss => {
      const seriesName = ss.name.includes(' - Mix ')
        ? ss.name.split(' - Mix ')[0].trim()
        : ss.name.includes(' - Vehicles ')
          ? ss.name.split(' - Vehicles ')[0].trim()
          : ss.name.includes(' - Vehicles')
            ? ss.name.split(' - Vehicles')[0].trim()
            : ss.name;
      if (!seriesNameMap.has(seriesName)) seriesNameMap.set(seriesName, seriesName);
    });
    const extractYear = (name: string): number => {
      const m = name.match(/\((\d{4})\)/);
      return m ? parseInt(m[1], 10) : 9999;
    };
    let seriesList = Array.from(seriesNameMap.entries())
      .sort((a, b) => {
        const yA = extractYear(a[0]), yB = extractYear(b[0]);
        return yA !== yB ? yA - yB : a[0].localeCompare(b[0]);
      })
      .map(([name]) => ({ id: 0, name }));
    if (selectedYear) {
      seriesList = seriesList.filter(s => extractYear(s.name) === selectedYear);
    }
    processedSubSeriesForCollection = seriesList;
  } else {
    processedSubSeriesForCollection = subSeriesForCollection as Array<{ id: number; name: string }>;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Varyantlar</h2>

      <VariantsFilterForm
        years={years}
        collectionsForYear={collectionsForYear}
        subSeriesForCollection={processedSubSeriesForCollection}
        categoriesForCollection={categoriesForCollection}
        selectedCategory={categoryParam}
        selectedSubSeriesName={subSeriesName}
        selectedYear={selectedYear}
        collectionName={collectionName}
        collectionId={actualCollectionId}
        subSeriesId={subSeriesId}
        search={search}
        onlyTH={onlyTH}
        onlySTH={onlySTH}
        packedOwnedStatus={packedOwnedStatus}
        looseOwnedStatus={looseOwnedStatus}
        wishlistedStatus={wishlistedStatus}
      />

      <AdvancedFiltersWrapper type="variants" savedFilters={savedFilters} />

      {/* Pagination - Top */}
      {totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          selectedYear={selectedYear}
          search={search}
          onlyTH={onlyTH}
          onlySTH={onlySTH}
          packedOwnedStatus={packedOwnedStatus}
          looseOwnedStatus={looseOwnedStatus}
          wishlistedStatus={wishlistedStatus}
          collectionName={collectionName}
          collectionId={actualCollectionId}
          subSeriesId={subSeriesId}
          category={categoryParam}
          subSeriesName={subSeriesName}
        />
      )}

      {/* Varyant listesi */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {variants.map((variant: any) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            togglePackedOwnedAction={togglePackedOwnedInline}
            toggleLooseOwnedAction={toggleLooseOwnedInline}
            toggleWishAction={toggleWishInline}
            updateQuantityAction={updateQuantityInline}
            deleteModelAction={deleteModelAction}
          />
        ))}
      </div>

      {variants.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Seçilen filtrelerle eşleşen kayıt bulunamadı.
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
          onlyTH={onlyTH}
          onlySTH={onlySTH}
          packedOwnedStatus={packedOwnedStatus}
          looseOwnedStatus={looseOwnedStatus}
          wishlistedStatus={wishlistedStatus}
          collectionName={collectionName}
          collectionId={actualCollectionId}
          subSeriesId={subSeriesId}
          category={categoryParam}
          subSeriesName={subSeriesName}
        />
      )}
    </div>
  );
}
