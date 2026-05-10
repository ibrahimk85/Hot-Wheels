import fs from 'fs';

/**
 * Hot Wheels Wiki placeholders (see api.php?titles=File:Image_Not_Available.jpg|File:No_Image.jpg).
 * Real car photos are typically much larger after full-size URL download.
 */

const URL_PLACEHOLDER_PATH_REGEX =
  /Image_Not_Available|Image%20Not%20Available|Image-Not-Available|No_Image\.|No%20Image\.|No-Image\./i;

export function isWikiPlaceholderOrMissingImageUrl(url: string): boolean {
  try {
    const u = url.toLowerCase();
    if (URL_PLACEHOLDER_PATH_REGEX.test(u)) return true;
    const path = new URL(url).pathname.toLowerCase();
    return URL_PLACEHOLDER_PATH_REGEX.test(path);
  } catch {
    return URL_PLACEHOLDER_PATH_REGEX.test(url);
  }
}

/** JPEG SOF0/SOF2: read dimensions from buffer (first ~64KB enough). */
function readJpegDimensions(buf: Buffer): { w: number; h: number } | null {
  let i = 0;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) break;
    if (marker >= 0xc0 && marker <= 0xc3) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && h > 0) return { w, h };
    }
    if (marker === 0xda) break;
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) break;
    i += 2 + segLen;
  }
  return null;
}

function readPngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.toString('ascii', 0, 8) !== '\x89PNG\r\n\x1a\n') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w > 0 && h > 0) return { w, h };
  return null;
}

export function readImageDimensionsFromBuffer(buf: Buffer): { w: number; h: number } | null {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return readJpegDimensions(buf);
  return readPngDimensions(buf);
}

/**
 * True if local file is almost certainly a Fandom "no image" / placeholder graphic
 * (small dimensions like 216×144), so we should re-fetch from wiki.
 */
export async function isLikelyWikiPlaceholderImageFile(filePath: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(filePath);
    if (!st.isFile()) return false;
    const maxRead = Math.min(st.size, 256 * 1024);
    const fd = await fs.promises.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(maxRead);
      const { bytesRead } = await fd.read(buf, 0, maxRead, 0);
      const slice = buf.subarray(0, bytesRead);
      const dim = readImageDimensionsFromBuffer(slice);
      if (!dim) return st.size < 8000;
      const { w, h } = dim;
      // Hot Wheels wiki: Image Not Available 216×144, No Image 252×144
      if (h === 144 && w <= 320) return true;
      if (w < 500 && h < 280 && w * h < 120_000) return true;
      return false;
    } finally {
      await fd.close();
    }
  } catch {
    return false;
  }
}

function envForceWikiImageRefresh(): boolean {
  const t = (v: string | undefined) => v === '1' || v === 'true';
  return (
    t(process.env.WIKI_IMAGES_FORCE) ||
    t(process.env.BOULEVARD_IMAGES_FORCE)
  );
}

/** Re-download when missing, WIKI_IMAGES_FORCE / BOULEVARD_IMAGES_FORCE, or file looks like wiki placeholder. */
export async function shouldDownloadOrReplaceBoulevardFile(destPath: string): Promise<boolean> {
  if (envForceWikiImageRefresh()) return true;
  if (!fs.existsSync(destPath)) return true;
  return isLikelyWikiPlaceholderImageFile(destPath);
}

/** Alias for Fast & Furious Premium and other wiki image scripts. */
export const shouldDownloadOrReplaceWikiCachedFile = shouldDownloadOrReplaceBoulevardFile;

export function envForceBoulevardImageRefresh(): boolean {
  return envForceWikiImageRefresh();
}
