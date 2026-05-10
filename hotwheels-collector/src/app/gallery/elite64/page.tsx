import prisma from '@/db';
import { Elite64GalleryClient } from '@/components/Elite64GalleryClient';

export default async function Elite64GalleryPage() {
  try {
    // Get all Elite 64 gallery images
    // Gallery images are in /elite64/gallery/ path
    // They can be linked to Elite 64 models or standalone
    const allGalleryImages = await prisma.image.findMany({
      where: {
        OR: [
          { path: { contains: '/elite64/gallery/' } },
          { path: { contains: '/gallery/elite64/' } }, // Fallback for old path
        ],
      },
      include: {
        model: {
          include: {
            collection: {
              include: {
                year: true,
              },
            },
            subSeries: true,
          },
        },
      },
    });

    // Filter to only show Elite 64 related images (linked to Elite 64 models or standalone)
    // Sort by name (null values last)
    const galleryImages = allGalleryImages
      .filter((img) => {
        // If linked to a model, check if it's Elite 64
        if (img.model?.collection) {
          return img.model.collection.name === 'Elite 64';
        }
        // If standalone (not linked), include it (assuming it's for Elite 64 gallery)
        return true;
      })
      .sort((a, b) => {
        // Sort by path (filename) since name field may not be available
        const pathA = a.path.split('/').pop() || '';
        const pathB = b.path.split('/').pop() || '';
        return pathA.localeCompare(pathB);
      });

    // Get Elite 64 collections with their years, sub-series, and models for the linking dropdowns
    const elite64Collections = await prisma.collection.findMany({
      where: {
        name: 'Elite 64',
      },
      include: {
        year: true,
        subSeries: {
          include: {
            models: {
              select: {
                id: true,
                castingName: true,
                toyNumber: true,
                seriesNumber: true,
              },
              orderBy: {
                castingName: 'asc',
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
        models: {
          select: {
            id: true,
            castingName: true,
            toyNumber: true,
            seriesNumber: true,
            subSeriesId: true,
          },
          orderBy: {
            castingName: 'asc',
          },
        },
      },
      orderBy: {
        yearId: 'desc',
      },
    });

    // Group by year for easier filtering
    const collectionsByYear = new Map<number | string, typeof elite64Collections>();
    for (const collection of elite64Collections) {
      const yearKey = collection.isFuture ? 'Future' : collection.year.year;
      if (!collectionsByYear.has(yearKey)) {
        collectionsByYear.set(yearKey, []);
      }
      collectionsByYear.get(yearKey)!.push(collection);
    }

    return (
      <Elite64GalleryClient
        galleryImages={galleryImages}
        collectionsByYear={Array.from(collectionsByYear.entries()).map(([year, collections]) => ({
          year: year === 'Future' ? 'Future' : Number(year),
          collections,
        }))}
      />
    );
  } catch (error) {
    console.error('Error loading Elite 64 gallery:', error);
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Elite 64 Gallery</h1>
        <p className="text-red-500">Error loading gallery images. Please try again later.</p>
      </div>
    );
  }
}
