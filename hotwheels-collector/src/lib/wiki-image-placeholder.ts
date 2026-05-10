/**
 * Fandom wiki "Image Not Available" / "No Image" assets (same patterns as scripts/lib/wiki-placeholder-image.ts).
 * Used in the UI to prefer loose or skip bad previews for Boulevard-style variant images.
 */

const URL_PLACEHOLDER_REGEX =
  /Image_Not_Available|Image%20Not%20Available|Image-Not-Available|No_Image\.|No%20Image\.|No-Image\./i;

export function isWikiPlaceholderPreviewImage(img: {
  path: string;
  alt?: string | null;
}): boolean {
  const alt = (img.alt ?? '').trim();
  if (/image\s*not\s*available|no\s*image\s*available|^no\s*image$/i.test(alt)) {
    return true;
  }
  const p = img.path.toLowerCase();
  if (URL_PLACEHOLDER_REGEX.test(p)) {
    return true;
  }
  try {
    const pathname = new URL(img.path, 'https://example.com').pathname.toLowerCase();
    if (URL_PLACEHOLDER_REGEX.test(pathname)) {
      return true;
    }
  } catch {
    /* relative path */
  }
  return false;
}

export function filterOutWikiPlaceholderImages<
  T extends { path: string; alt?: string | null },
>(images: T[] | null | undefined): T[] {
  if (!images?.length) {
    return [];
  }
  return images.filter((i) => !isWikiPlaceholderPreviewImage(i));
}

/**
 * After the browser decodes the image: Fandom "Image Not Available" / "No Image" JPEGs
 * match small sizes (see scripts/lib/wiki-placeholder-image.ts). Local *_carded.jpg copies
 * keep normal paths, so this is the reliable UI check.
 */
export function dimensionsLookLikeFandomWikiPlaceholder(
  naturalWidth: number,
  naturalHeight: number,
): boolean {
  const w = naturalWidth;
  const h = naturalHeight;
  if (!(w > 0 && h > 0)) {
    return false;
  }
  if (h === 144 && w <= 320) {
    return true;
  }
  if (w < 500 && h < 280 && w * h < 120_000) {
    return true;
  }
  return false;
}
