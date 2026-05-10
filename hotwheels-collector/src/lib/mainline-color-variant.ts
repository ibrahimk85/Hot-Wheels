/**
 * Mainline wiki-style color rows: "(2nd Color)", "(4th Color)", etc.
 * Used for image badge (VariantCard) and Toy# lookup for image search.
 */

const ORDINAL_COLOR_RE = /(\d+)(st|nd|rd|th)\s*color/i;

export function mainlineOrdinalColorBadgeText(
  color: string | null | undefined,
): string | null {
  if (!color) return null;
  const m = color.trim().match(ORDINAL_COLOR_RE);
  if (!m) return null;
  return `${m[1]}${m[2].toLowerCase()} color`;
}

export function isMainlineOrdinalColorVariant(color: string | null | undefined): boolean {
  return mainlineOrdinalColorBadgeText(color) != null;
}

/**
 * Sort key for mainline color variants. The "1st color" row carries no
 * "(Nth Color)" suffix in the wiki, so its `color` is null/empty → sort 1.
 * "(2nd Color)" → 2, "(3rd Color)" → 3, etc. Falls back to a large number
 * for unknown values so they sort after the recognized ordinals.
 */
export function mainlineOrdinalColorSortKey(color: string | null | undefined): number {
  if (!color || !color.trim()) return 1;
  const m = color.trim().match(ORDINAL_COLOR_RE);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
