import prisma from '@/db';

// Yeni resim kaydı ekle
export async function createImage(data: {
  path: string;
  alt?: string;
  modelId?: number;
  variantId?: number;
  order?: number; // Order field for sorting
  notes?: string; // Notes field for metadata
}) {
  return prisma.image.create({ data });
}

// Bir model veya varyant için resimleri getir
export async function getImagesByModelId(modelId: number) {
  return prisma.image.findMany({ where: { modelId } });
}

export async function getImagesByVariantId(variantId: number) {
  return prisma.image.findMany({ where: { variantId } });
}

// Görseli sil
export async function deleteImage(imageId: number) {
  // First check if this image is used as mainImageId in any model
  const modelsWithThisMainImage = await prisma.model.findMany({
    where: { mainImageId: imageId },
  });

  // If it's a main image, set mainImageId to null for those models
  if (modelsWithThisMainImage.length > 0) {
    await prisma.model.updateMany({
      where: { mainImageId: imageId },
      data: { mainImageId: null },
    });
  }

  // Delete the image record
  return prisma.image.delete({
    where: { id: imageId },
  });
}

// Tüm görüntüleri listele (ImageEditor için)
export async function getAllImages() {
  return prisma.image.findMany({
    include: {
      variant: {
        include: {
          model: true,
        },
      },
      model: true,
    },
    orderBy: {
      id: 'desc',
    },
  });
}

// Ana görseli ayarla
export async function setMainImage(modelId: number, imageId: number) {
  // Verify image belongs to model
  const image = await prisma.image.findFirst({
    where: {
      id: imageId,
      OR: [
        { modelId: modelId },
        {
          variant: {
            modelId: modelId,
          },
        },
      ],
    },
  });

  if (!image) {
    throw new Error('Image not found or does not belong to this model');
  }

  return prisma.model.update({
    where: { id: modelId },
    data: { mainImageId: imageId },
  });
}

// Slugify helper function
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Klasör yolu oluştur
export function getImageFolderPath(
  year: number,
  collectionName: string,
  castingName: string
): string {
  const castingSlug = slugify(castingName);
  return `images/hotwheels/${year}/${collectionName}/${castingSlug}`;
}

// Dosya ismi oluştur (mevcut pattern'e göre)
export function generateImageFileName(
  originalName: string,
  imageType: 'carded' | 'loose' | 'other' = 'other',
  toyNumber?: string | null
): string {
  // Extract extension
  const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

  // Generate filename based on type
  const timestamp = Date.now();
  
  if (imageType === 'carded') {
    const prefix = toyNumber ? `carded-${toyNumber}` : `carded-${timestamp}`;
    return `${prefix}.${ext}`;
  } else if (imageType === 'loose') {
    const prefix = toyNumber ? `loose-${toyNumber}` : `loose-${timestamp}`;
    return `${prefix}.${ext}`;
  } else {
    // For other types, use timestamp or toyNumber if available
    const prefix = toyNumber ? toyNumber : `img-${timestamp}`;
    return `${prefix}.${ext}`;
  }
}

