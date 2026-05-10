import prisma from '@/db';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import Image from 'next/image';
import { getModels, getModelsCount, deleteModel } from '@/features/models/model.service';
import { getThemedMultipacks } from '@/features/themed-multipack/themed-multipack.service';
import { Card, CardContent } from '@/components/ui/card';
import CollectionsFilterForm from './collections-filter-form';
import { ModelCard } from '@/components/ModelCard';
import { ShareDialog } from '@/components/ShareDialog';

type CollectionPageProps = {
  params: Promise<{ collectionName: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Normalize collection name (capitalize first letter of each word)
// Handles URL-encoded names, hyphens, and converts to proper case
// Examples: "pop-culture" -> "Pop Culture", "fast-and-furious-premium" -> "Fast & Furious Premium"
function normalizeCollectionName(name: string): string {
  try {
    // Decode URL encoding (e.g., "Pop%20Culture" -> "Pop Culture")
    const decoded = decodeURIComponent(name);
    
    // Split by spaces, hyphens, or underscores and capitalize each word
    const words = decoded.split(/[\s\-_]+/).filter(word => word.length > 0);
    
    const normalized = words
      .map((word, index) => {
        // Handle "and" -> "&" conversion (but not at the start or end)
        if (word.toLowerCase() === 'and' && index > 0 && index < words.length - 1) {
          return '&';
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .replace(/\s+&\s+/g, ' & '); // Ensure proper spacing around &
    
    return normalized;
  } catch (error) {
    // If decoding fails, try with original name
    const words = name.split(/[\s\-_]+/).filter(word => word.length > 0);
    return words
      .map((word, index) => {
        if (word.toLowerCase() === 'and' && index > 0 && index < words.length - 1) {
          return '&';
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .replace(/\s+&\s+/g, ' & ');
  }
}

// Owned için inline toggle
async function toggleOwnedInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentOwnedRaw = formData.get('currentOwned');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentOwned = currentOwnedRaw === 'true';
  const newOwnedStatus = !currentOwned;

  // Model'i güncelle
  await prisma.model.update({
    where: { id },
    data: { owned: newOwnedStatus },
  });

  // Model'in tüm variant'larını da güncelle
  await prisma.variant.updateMany({
    where: { modelId: id },
    data: { owned: newOwnedStatus },
  });

  revalidatePath('/collections', 'layout');
  revalidatePath('/variants');
  revalidatePath('/', 'layout');
}

// Wishlist için inline toggle
async function toggleWishlistInline(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const currentWishRaw = formData.get('currentWish');

  const id = Number(idRaw);
  if (Number.isNaN(id)) return;

  const currentWish = currentWishRaw === 'true';
  const newWishlistStatus = !currentWish;

  // Model'i güncelle
  await prisma.model.update({
    where: { id },
    data: { wishlisted: newWishlistStatus },
  });

  // Model'in tüm variant'larını da güncelle
  await prisma.variant.updateMany({
    where: { modelId: id },
    data: { wishlisted: newWishlistStatus },
  });

  revalidatePath('/collections', 'layout');
  revalidatePath('/variants');
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

  await prisma.model.update({
    where: { id },
    data: { quantity: qty },
  });

  revalidatePath('/collections', 'layout');
}

// Model silme
async function deleteModelAction(formData: FormData) {
  'use server';

  const idRaw = formData.get('id');
  const collectionNameParam = formData.get('collectionName') as string;
  const id = Number(idRaw);
  
  if (Number.isNaN(id) || id <= 0) {
    return;
  }

  await deleteModel(id);
  
  revalidatePath('/collections', 'layout');
  revalidatePath('/variants');
  revalidatePath('/', 'layout');
  
  // Mevcut koleksiyon sayfasını da güncelle
  if (collectionNameParam) {
    // URL-safe collection name için normalize et
    const normalized = collectionNameParam.toLowerCase().replace(/\s+/g, '-');
    revalidatePath(`/collections/${normalized}`);
  }
}

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { collectionName } = await params;
  const paramsData = await searchParams;

  let normalizedCollectionName = normalizeCollectionName(collectionName);

  // Validate collection name exists - first try normalized name
  let collectionExists = await prisma.collection.findFirst({
    where: {
      name: normalizedCollectionName,
    },
  });

  // If not found, try to find by fuzzy matching (e.g., "Car Culture 2 Packs" -> "Car Culture 2-Packs")
  // This handles cases where hyphens in collection names are lost during normalization
  if (!collectionExists) {
    // Try to find collections with similar names (case-insensitive)
    const allCollections = await prisma.collection.findMany({
      select: {
        name: true,
      },
    });

    // Get unique collection names
    const uniqueCollectionNames = Array.from(new Set(allCollections.map(c => c.name)));

    // Try to find a match where the normalized version matches when we ignore hyphens
    const normalizedWithoutHyphens = normalizedCollectionName.replace(/\s+/g, ' ').toLowerCase();
    for (const collName of uniqueCollectionNames) {
      const collWithoutHyphens = collName.replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      if (normalizedWithoutHyphens === collWithoutHyphens) {
        normalizedCollectionName = collName;
        collectionExists = await prisma.collection.findFirst({
          where: {
            name: collName,
          },
        });
        break;
      }
    }
  }

  const qParam = paramsData?.q;
  const ownedParam = paramsData?.owned;
  const wishParam = paramsData?.wish as string | undefined;
  const yearParam = paramsData?.year as string | undefined;
  const categoryParam = paramsData?.category as string | undefined;
  const subSeriesParam = paramsData?.subSeries as string | undefined;
  const pageParam = paramsData?.page as string | undefined;

  const currentPage = Math.max(1, Number(pageParam) || 1);
  const pageSize = 36;
  const offset = (currentPage - 1) * pageSize;

  const search =
    typeof qParam === 'string' && qParam.trim().length > 0
      ? qParam.trim()
      : undefined;

  let ownedStatus: boolean | undefined;
  if (ownedParam === '1') ownedStatus = true;
  if (ownedParam === '0') ownedStatus = false;

  let wishlistedStatus: boolean | undefined;
  if (wishParam === '1') wishlistedStatus = true;
  if (wishParam === '0') wishlistedStatus = false;

  const selectedYear = yearParam ? Number(yearParam) : undefined;

  // Get all years for this collection
  const collections = await prisma.collection.findMany({
    where: {
      name: normalizedCollectionName,
    },
    include: {
      year: true,
    },
    orderBy: {
      yearId: 'desc',
    },
  });

  // For Hot Wheels Silver Series: Get years from variants, not collections
  let years: number[];
  if (normalizedCollectionName === 'Hot Wheels Silver Series') {
    const allVariants = await prisma.variant.findMany({
      where: {
        model: {
          collection: {
            name: 'Hot Wheels Silver Series',
          },
        },
      },
      select: {
        year: true,
      },
      distinct: ['year'],
    });
    years = allVariants.map(v => v.year).sort((a, b) => b - a);
  } else {
    years = Array.from(
      new Set(collections.map((c) => c.year.year))
    ).sort((a, b) => b - a);
  }

  // Special layout for Hot Wheels Themed Multipack
  if (normalizedCollectionName === 'Hot Wheels Themed Multipack') {
    const themedMultipacks = await getThemedMultipacks({
      collectionName: normalizedCollectionName,
      year: selectedYear,
    });

    const totalCount = themedMultipacks.length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{normalizedCollectionName}</h2>
          <div className="flex items-center gap-2">
            <ShareDialog
              type="collection"
              targetId={collectionExists.id}
              targetName={normalizedCollectionName}
            />
            <Link
              href="/collections"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Koleksiyonlara Dön
            </Link>
          </div>
        </div>

        <CollectionsFilterForm
          years={years.map((y) => ({ id: y, year: y }))}
          categoriesForCollection={[]}
          subSeriesForCollection={[]}
          selectedYear={selectedYear}
          selectedCategory={undefined}
          subSeriesId={undefined}
          subSeriesName={undefined}
          search={search}
          ownedStatus={ownedStatus}
          wishlistedStatus={wishlistedStatus}
          collectionName={normalizedCollectionName}
        />

        {totalCount > 0 && (
          <div className="text-sm text-muted-foreground">
            Toplam {totalCount} multipack
            {selectedYear ? ` • ${selectedYear}` : ''}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themedMultipacks.map((mp: any) => {
            const imageUrl: string | null = mp.imageUrl ?? null;
            let imageSrc: string | null = null;

            if (imageUrl) {
              if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                imageSrc = imageUrl;
              } else {
                let normalizedPath = imageUrl.replace(/\\/g, '/');
                if (!normalizedPath.startsWith('/')) {
                  normalizedPath = '/' + normalizedPath;
                }
                normalizedPath = normalizedPath.replace(/\/+/g, '/');
                imageSrc = normalizedPath;
              }
            }

            return (
              <Card key={mp.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {mp.packageCode}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {mp.year ?? mp.collection?.year?.year ?? '—'}
                    </div>
                  </div>

                  {imageSrc ? (
                    <div className="relative w-full h-40 rounded-md overflow-hidden bg-transparent">
                      <Image
                        src={imageSrc}
                        alt={mp.displayName || mp.themeName || 'Themed Multipack'}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground">
                      Kutu görseli yok
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="font-semibold text-sm">
                      {mp.themeName}
                    </div>
                    {mp.displayName && (
                      <div className="text-xs text-muted-foreground">
                        {mp.displayName}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Araçlar
                    </div>
                    <ul className="text-xs space-y-1">
                      {mp.items.map((item: any, index: number) => {
                        const variant = item.variant;
                        const model = variant?.model || item.model;
                        const castingName: string =
                          model?.castingName ?? 'Bilinmeyen Model';
                        const detail: string | undefined =
                          variant?.color ?? variant?.releaseName ?? undefined;
                        const position: number =
                          typeof item.position === 'number'
                            ? item.position
                            : index + 1;

                        return (
                          <li key={item.id ?? `${mp.id}-${position}`}>
                            <span className="text-muted-foreground mr-1">
                              {position}.
                            </span>
                            <span>
                              {castingName}
                              {detail ? ` – ${detail}` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {mp.notes && (
                    <div className="pt-2 border-t">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        Notlar
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {mp.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {themedMultipacks.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Seçilen filtrelerle eşleşen themed multipack bulunamadı.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!collectionExists) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Koleksiyon Bulunamadı</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            "{normalizedCollectionName}" koleksiyonu bulunamadı.
          </CardContent>
        </Card>
        <Link href="/collections" className="text-blue-600 hover:underline">
          ← Koleksiyonlara Dön
        </Link>
      </div>
    );
  }

  // Get subSeries for the selected collection (all years)
  // For Boulevard, group by name to show unique sub-series names across all years
  const allSubSeries = await prisma.subSeries.findMany({
    where: {
      collection: {
        name: normalizedCollectionName,
      },
    },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  // For Silver Series: two-level filter - categories and series names (e.g. "Blue and Gold (2026)")
  // For Boulevard: group by name
  // For other collections: keep as is
  let subSeriesList: Array<{ id: number; name: string }>;
  let categoriesList: Array<{ id: string; name: string }> = [];

  if (normalizedCollectionName === 'Hot Wheels Silver Series') {
    // Extract unique categories
    const categorySet = new Set<string>();
    for (const ss of allSubSeries) {
      if (ss.category) categorySet.add(ss.category);
    }
    categoriesList = Array.from(categorySet).sort().map(c => ({ id: c, name: c }));

    // Filter by category if selected, then derive unique "series" names (part before " - Mix X")
    const filteredForCategory = categoryParam
      ? allSubSeries.filter(ss => ss.category === categoryParam)
      : allSubSeries;
    const seriesNameMap = new Map<string, string>();
    for (const ss of filteredForCategory) {
      const seriesName = ss.name.includes(' - Mix ') ? ss.name.split(' - Mix ')[0].trim() : ss.name;
      if (!seriesNameMap.has(seriesName)) {
        seriesNameMap.set(seriesName, seriesName);
      }
    }
    // Sort by year: Purple and Gold (2025) before Blue and Gold (2026)
    const extractYear = (name: string): number => {
      const match = name.match(/\((\d{4})\)/);
      return match ? parseInt(match[1], 10) : 9999;
    };
    subSeriesList = Array.from(seriesNameMap.entries())
      .sort((a, b) => {
        const yearA = extractYear(a[0]);
        const yearB = extractYear(b[0]);
        if (yearA !== yearB) return yearA - yearB;
        return a[0].localeCompare(b[0]);
      })
      .map(([name]) => ({ id: 0, name }));
  } else if (normalizedCollectionName === 'Boulevard') {
    const uniqueSubSeriesMap = new Map<string, { id: number; name: string }>();
    for (const ss of allSubSeries) {
      if (!uniqueSubSeriesMap.has(ss.name)) {
        uniqueSubSeriesMap.set(ss.name, { id: ss.id, name: ss.name });
      }
    }
    subSeriesList = Array.from(uniqueSubSeriesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } else {
    subSeriesList = allSubSeries.map(ss => ({ id: ss.id, name: ss.name }));
  }

  // For Boulevard and Hot Wheels Silver Series, use subSeriesName; for others, use subSeriesId
  let subSeriesId: number | undefined;
  let subSeriesName: string | undefined;
  
  if ((normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') && subSeriesParam) {
    // For Boulevard and Silver Series, subSeriesParam is the name, not ID
    subSeriesName = subSeriesParam;
  } else if (subSeriesParam) {
    subSeriesId = Number(subSeriesParam);
  }

  // Get models with filters
  const [models, totalCount] = await Promise.all([
    getModels({
      collectionName: normalizedCollectionName,
      year: selectedYear,
      category: normalizedCollectionName === 'Hot Wheels Silver Series' ? categoryParam : undefined,
      subSeriesId: (normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? undefined : subSeriesId,
      subSeriesName: (normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? subSeriesName : undefined,
      ownedStatus,
      wishlistedStatus,
      search,
      limit: pageSize,
      offset,
    }),
    getModelsCount({
      collectionName: normalizedCollectionName,
      year: selectedYear,
      category: normalizedCollectionName === 'Hot Wheels Silver Series' ? categoryParam : undefined,
      subSeriesId: (normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? undefined : subSeriesId,
      subSeriesName: (normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? subSeriesName : undefined,
      ownedStatus,
      wishlistedStatus,
      search,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{normalizedCollectionName}</h2>
        <div className="flex items-center gap-2">
          <ShareDialog
            type="collection"
            targetId={collectionExists.id}
            targetName={normalizedCollectionName}
          />
          <Link
            href="/collections"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Koleksiyonlara Dön
          </Link>
        </div>
      </div>

      <CollectionsFilterForm
        years={years.map((y) => ({ id: y, year: y }))}
        categoriesForCollection={normalizedCollectionName === 'Hot Wheels Silver Series' ? categoriesList : []}
        subSeriesForCollection={subSeriesList}
        selectedYear={selectedYear}
        selectedCategory={normalizedCollectionName === 'Hot Wheels Silver Series' ? categoryParam : undefined}
        subSeriesId={(normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? undefined : subSeriesId}
        subSeriesName={(normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') ? subSeriesName : undefined}
        search={search}
        ownedStatus={ownedStatus}
        wishlistedStatus={wishlistedStatus}
        collectionName={normalizedCollectionName}
      />

      {/* Pagination - Top */}
      {totalCount > 0 && (
        <div className="text-sm text-muted-foreground">
          Toplam {totalCount} model • Sayfa {currentPage} / {totalPages}
        </div>
      )}

      {/* Model listesi */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {models.map((model: any) => (
          <ModelCard
            key={model.id}
            model={model}
            toggleOwnedAction={toggleOwnedInline}
            toggleWishlistAction={toggleWishlistInline}
            updateQuantityAction={updateQuantityInline}
            deleteModelAction={deleteModelAction}
            hideActions={true}
          />
        ))}
      </div>

      {models.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Seçilen filtrelerle eşleşen kayıt bulunamadı.
          </CardContent>
        </Card>
      )}

      {/* Pagination - Bottom */}
      {totalCount > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/collections/${collectionName}?${new URLSearchParams({
                ...(selectedYear ? { year: selectedYear.toString() } : {}),
                ...(normalizedCollectionName === 'Hot Wheels Silver Series' && categoryParam ? { category: categoryParam } : {}),
                ...((normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') && subSeriesName
                  ? { subSeries: subSeriesName }
                  : subSeriesId
                  ? { subSeries: subSeriesId.toString() }
                  : {}),
                ...(ownedStatus !== undefined
                  ? { owned: ownedStatus ? '1' : '0' }
                  : {}),
                ...(wishlistedStatus !== undefined
                  ? { wish: wishlistedStatus ? '1' : '0' }
                  : {}),
                ...(search ? { q: search } : {}),
                page: (currentPage - 1).toString(),
              }).toString()}`}
              className="px-4 py-2 border rounded hover:bg-muted"
            >
              ← Önceki
            </Link>
          )}
          <span className="px-4 py-2">
            Sayfa {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/collections/${collectionName}?${new URLSearchParams({
                ...(selectedYear ? { year: selectedYear.toString() } : {}),
                ...(normalizedCollectionName === 'Hot Wheels Silver Series' && categoryParam ? { category: categoryParam } : {}),
                ...((normalizedCollectionName === 'Boulevard' || normalizedCollectionName === 'Hot Wheels Silver Series') && subSeriesName
                  ? { subSeries: subSeriesName }
                  : subSeriesId
                  ? { subSeries: subSeriesId.toString() }
                  : {}),
                ...(ownedStatus !== undefined
                  ? { owned: ownedStatus ? '1' : '0' }
                  : {}),
                ...(wishlistedStatus !== undefined
                  ? { wish: wishlistedStatus ? '1' : '0' }
                  : {}),
                ...(search ? { q: search } : {}),
                page: (currentPage + 1).toString(),
              }).toString()}`}
              className="px-4 py-2 border rounded hover:bg-muted"
            >
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

