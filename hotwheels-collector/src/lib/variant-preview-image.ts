import { isWikiPlaceholderPreviewImage } from '@/lib/wiki-image-placeholder';

/**
 * Collections where carded/loose art lives on Variant (+ Image.variantId), not Model.images.
 */
export const VARIANT_LEVEL_PREVIEW_COLLECTIONS = new Set([
  'Boulevard',
  'Fast & Furious',
  'Fast & Furious Premium',
  'Neon Speeders',
]);

export function collectionUsesVariantLevelPreviewImages(
  collectionName: string | null | undefined,
): boolean {
  return !!collectionName && VARIANT_LEVEL_PREVIEW_COLLECTIONS.has(collectionName);
}

type VariantPreviewInput = {
  imageId: number | null;
  images?: Array<{ id: number; path: string; alt: string | null }> | null;
};

/** Prefer variant.imageId (carded), then path containing "carded", else first non-wiki-placeholder image. */
export function pickVariantCardPreviewImage(
  collectionName: string | null | undefined,
  variant: VariantPreviewInput | null | undefined,
): { id: number; path: string; alt: string | null } | undefined {
  if (!variant?.images?.length) return undefined;
  if (!collectionName || !VARIANT_LEVEL_PREVIEW_COLLECTIONS.has(collectionName)) {
    const usable = variant.images.find((i) => !isWikiPlaceholderPreviewImage(i));
    return usable;
  }

  const ordered: Array<{ id: number; path: string; alt: string | null }> = [];
  const pushUnique = (i: { id: number; path: string; alt: string | null }) => {
    if (!ordered.some((o) => o.id === i.id)) ordered.push(i);
  };

  if (variant.imageId != null) {
    const byId = variant.images.find((x) => x.id === variant.imageId);
    if (byId) pushUnique(byId);
  }
  const carded = variant.images.find((i) => i.path.toLowerCase().includes('carded'));
  if (carded) pushUnique(carded);
  const loose = variant.images.find((i) => i.path.toLowerCase().includes('loose'));
  if (loose) pushUnique(loose);
  for (const i of variant.images) {
    pushUnique(i);
  }

  const usable = ordered.find((i) => !isWikiPlaceholderPreviewImage(i));
  return usable;
}

/**
 * Ordered candidates for variant-level collections (carded → loose → rest → model fallback).
 * Used by the client to skip Fandom placeholder JPEGs by decoded dimensions.
 */
export function getVariantLevelPreviewCandidates(
  collectionName: string | null | undefined,
  variant: VariantPreviewInput | null | undefined,
  modelImages?: Array<{ id: number; path: string; alt: string | null }> | null,
): Array<{ id: number; path: string; alt: string | null }> {
  const out: Array<{ id: number; path: string; alt: string | null }> = [];
  const pushUnique = (i: { id: number; path: string; alt: string | null }) => {
    if (!out.some((o) => o.id === i.id)) {
      out.push(i);
    }
  };

  const useOrdering =
    !!collectionName && VARIANT_LEVEL_PREVIEW_COLLECTIONS.has(collectionName);

  if (variant?.images?.length) {
    if (useOrdering) {
      if (variant.imageId != null) {
        const byId = variant.images.find((x) => x.id === variant.imageId);
        if (byId) {
          pushUnique(byId);
        }
      }
      const carded = variant.images.find((i) =>
        i.path.toLowerCase().includes('carded'),
      );
      if (carded) {
        pushUnique(carded);
      }
      const loose = variant.images.find((i) =>
        i.path.toLowerCase().includes('loose'),
      );
      if (loose) {
        pushUnique(loose);
      }
      for (const i of variant.images) {
        pushUnique(i);
      }
    } else {
      for (const i of variant.images) {
        pushUnique(i);
      }
    }
  }

  if (modelImages?.length) {
    for (const i of modelImages) {
      pushUnique(i);
    }
  }

  return out;
}

/** Model grid: try each variant’s preview order, then model-level images (dedup by image id). */
export function getModelCardVariantLevelCandidates(
  collectionName: string | null | undefined,
  variants: VariantPreviewInput[] | null | undefined,
  modelImages?: Array<{ id: number; path: string; alt: string | null }> | null,
): Array<{ id: number; path: string; alt: string | null }> {
  const out: Array<{ id: number; path: string; alt: string | null }> = [];
  const pushUnique = (i: { id: number; path: string; alt: string | null }) => {
    if (!out.some((o) => o.id === i.id)) {
      out.push(i);
    }
  };
  for (const v of variants ?? []) {
    for (const i of getVariantLevelPreviewCandidates(collectionName, v, null)) {
      pushUnique(i);
    }
  }
  if (modelImages?.length) {
    for (const i of modelImages) {
      pushUnique(i);
    }
  }
  return out;
}

/** First non-empty preview among variants (e.g. model card when multiple variant years exist). */
export function pickFirstVariantPreviewAmong(
  collectionName: string | null | undefined,
  variants: VariantPreviewInput[] | null | undefined,
): { id: number; path: string; alt: string | null } | undefined {
  if (!variants?.length) return undefined;
  for (const v of variants) {
    const img = pickVariantCardPreviewImage(collectionName, v);
    if (img) return img;
  }
  return undefined;
}
