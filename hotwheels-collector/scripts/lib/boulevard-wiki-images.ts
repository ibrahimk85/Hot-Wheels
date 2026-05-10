import type { PrismaClient } from '@prisma/client';

/** Where shape built by Boulevard image download scripts (strict color match first). */
export type BoulevardVariantImageWhere = {
  modelId: number;
  year: number;
  cardNumber: string;
  color: string | null;
};

/**
 * Fandom wiki tables often put a 1×1 data: GIF in `src` and the real CDN URL in `data-src`.
 * Prefer a non-data: URL from either attribute.
 */
export function wikiImageUrlFromCheerioImg($img: {
  length?: number;
  attr(name: string): string | undefined;
}): string {
  if (!$img.length) return '';
  const dataSrc = ($img.attr('data-src') || '').trim();
  const src = ($img.attr('src') || '').trim();
  const usable = (u: string) => u && !u.toLowerCase().startsWith('data:');
  if (usable(dataSrc)) return dataSrc;
  if (usable(src)) return src;
  return dataSrc || src;
}

/**
 * Strict match on color; if wiki vs DB color strings differ slightly, fall back to the same
 * model + year + series# (first variant).
 */
export async function findBoulevardVariantWithColorFallback(
  prisma: PrismaClient,
  w: BoulevardVariantImageWhere,
) {
  let v = await prisma.variant.findFirst({ where: w });
  if (!v && w.color !== null) {
    v = await prisma.variant.findFirst({
      where: {
        modelId: w.modelId,
        year: w.year,
        cardNumber: w.cardNumber,
      },
      orderBy: { id: 'asc' },
    });
  }
  return v;
}
