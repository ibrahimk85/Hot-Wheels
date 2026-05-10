import fs from 'fs';
import path from 'path';

export interface ModelDataForDownload {
  castingName: string;
  year?: number;
  collectionName?: string;
  toyNumber?: string;
  variants?: Array<{
    toyNumber?: string;
  }>;
}

/**
 * Slugify a string for use in folder/file names
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Download and save an image from URL to the appropriate folder structure
 * Uses the same folder structure as variant images: public/images/hotwheels/{year}/{collection-slug}/{casting-slug}/
 * @param url - Image URL to download
 * @param modelData - Model information for folder structure and filename
 * @returns Relative path from public folder (e.g., /images/hotwheels/2025/mainline/casting-name/toy123.jpg)
 */
export async function downloadAndSaveImage(
  url: string,
  modelData: ModelDataForDownload
): Promise<string> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid image URL');
  }

  // Validate required fields
  if (!modelData.castingName) {
    throw new Error('Casting name is required');
  }

  const year = modelData.year || new Date().getFullYear();
  const collectionSlug = modelData.collectionName
    ? slugify(modelData.collectionName)
    : 'unknown';
  const castingSlug = slugify(modelData.castingName);

  // Build folder path: public/images/hotwheels/{year}/{collection-slug}/{casting-slug}/
  const baseDir = path.join(
    process.cwd(),
    'public',
    'images',
    'hotwheels',
    year.toString(),
    collectionSlug,
    castingSlug
  );

  // Create directory if it doesn't exist
  await fs.promises.mkdir(baseDir, { recursive: true });

  // Determine filename
  let fileName: string;
  const urlObj = new URL(url);
  const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

  // Validate extension (only allow image formats)
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  // Filename logic:
  // 1. If model has toyNumber: use {toyNumber}.{ext}
  // 2. If no toyNumber but first variant has toyNumber: use variant's toyNumber
  // 3. Otherwise: use {casting-slug}-model.{ext}
  if (modelData.toyNumber && modelData.toyNumber.trim()) {
    fileName = `${modelData.toyNumber.trim()}.${ext}`;
  } else if (
    modelData.variants &&
    modelData.variants.length > 0 &&
    modelData.variants[0].toyNumber &&
    modelData.variants[0].toyNumber.trim()
  ) {
    fileName = `${modelData.variants[0].toyNumber.trim()}.${ext}`;
  } else {
    fileName = `${castingSlug}-model.${ext}`;
  }

  // If file with same name exists, add timestamp to make it unique
  let destPath = path.join(baseDir, fileName);
  let finalFileName = fileName;
  
  if (fs.existsSync(destPath)) {
    // File exists - add timestamp to make it unique
    const nameWithoutExt = path.parse(fileName).name;
    const ext = path.parse(fileName).ext;
    const timestamp = Date.now();
    finalFileName = `${nameWithoutExt}-${timestamp}${ext}`;
    destPath = path.join(baseDir, finalFileName);
    console.log('[IMAGE DOWNLOAD] File with same name exists, using unique name:', finalFileName);
  }

  // Download image
  try {
    console.log('[IMAGE DOWNLOAD] Fetching image from URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });

    console.log('[IMAGE DOWNLOAD] Response status:', response.status, response.statusText);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `Resim indirilemedi: Erişim engellendi (403 Forbidden). Bu resim hotlink koruması nedeniyle doğrudan indirilemiyor. Lütfen farklı bir resim seçin veya resmi bilgisayarınıza indirip yükleyin.`
        );
      }
      if (response.status === 404) {
        throw new Error(
          `Resim bulunamadı (404 Not Found). Resim URL'si geçersiz veya silinmiş olabilir.`
        );
      }
      throw new Error(
        `Resim indirilemedi: ${response.status} ${response.statusText}`
      );
    }

    // Validate content type
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`URL does not point to an image: ${contentType}`);
    }

    // Get image buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optional: Check minimum dimensions (basic validation)
    // For now, we'll just check file size (should be > 0)
    if (buffer.length === 0) {
      throw new Error('Downloaded image is empty');
    }

    // Save to disk
    console.log('[IMAGE DOWNLOAD] Writing file to:', destPath);
    console.log('[IMAGE DOWNLOAD] File size:', buffer.length, 'bytes');
    console.log('[IMAGE DOWNLOAD] Directory exists:', fs.existsSync(baseDir));
    
    await fs.promises.writeFile(destPath, buffer);
    
    // Verify file was written
    const fileExists = fs.existsSync(destPath);
    const fileStats = fileExists ? await fs.promises.stat(destPath) : null;
    console.log('[IMAGE DOWNLOAD] File written successfully:', fileExists);
    console.log('[IMAGE DOWNLOAD] File size on disk:', fileStats?.size || 'N/A', 'bytes');
    
    if (!fileExists) {
      throw new Error(`File was not written to disk: ${destPath}`);
    }
    
    if (fileStats && fileStats.size === 0) {
      throw new Error(`File was written but is empty: ${destPath}`);
    }

    // Return relative path from public folder (use finalFileName, not fileName)
    const relativePath = path
      .join(
        '/images',
        'hotwheels',
        year.toString(),
        collectionSlug,
        castingSlug,
        finalFileName
      )
      .replace(/\\/g, '/');
    
    console.log('[IMAGE DOWNLOAD] Returning relative path:', relativePath);
    return relativePath;
  } catch (error) {
    // Clean up partial file if it exists
    if (fs.existsSync(destPath)) {
      try {
        await fs.promises.unlink(destPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    throw error;
  }
}

