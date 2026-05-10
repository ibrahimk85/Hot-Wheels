import prisma from '@/db';
import { RLCGalleryClient } from '@/components/RLCGalleryClient';

export default async function RLCGalleryPage() {
  try {
    // Get all RLC gallery images
    // Gallery images are in /rlc/gallery/ path
    // They can be linked to RLC models or standalone
    const allGalleryImages = await prisma.image.findMany({
      where: {
        OR: [
          { path: { contains: '/rlc/gallery/' } },
          { path: { contains: '/gallery/rlc/' } }, // Fallback for old path
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

    // Filter to only show RLC related images (linked to RLC models or standalone)
    // Sort by name (null values last)
    const galleryImages = allGalleryImages
      .filter((img) => {
        // If linked to a model, check if it's RLC
        if (img.model?.collection) {
          return img.model.collection.name === 'Red Line Club';
        }
        // If standalone (not linked), include it (assuming it's for RLC gallery)
        return true;
      })
      .sort((a, b) => {
        // Sort by path (filename) since name field may not be available
        const pathA = a.path.split('/').pop() || '';
        const pathB = b.path.split('/').pop() || '';
        return pathA.localeCompare(pathB);
      });

    // Get RLC collections with their years, sub-series, and models for the linking dropdowns
    const rlcCollections = await prisma.collection.findMany({
      where: {
        name: 'Red Line Club',
      },
      include: {
        year: true,
        subSeries: {
          include: {
            models: {
              select: {
                id: true,
                castingName: true,
                saleDate: true,
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
            saleDate: true,
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
    const collectionsByYear = new Map<number, typeof rlcCollections>();
    for (const collection of rlcCollections) {
      const yearKey = collection.year.year;
      if (!collectionsByYear.has(yearKey)) {
        collectionsByYear.set(yearKey, []);
      }
      collectionsByYear.get(yearKey)!.push(collection);
    }

    return (
      <RLCGalleryClient
        galleryImages={galleryImages}
        collectionsByYear={Array.from(collectionsByYear.entries()).map(([year, collections]) => ({
          year: Number(year),
          collections,
        }))}
      />
    );
  } catch (error) {
    console.error('Error loading RLC gallery:', error);
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Red Line Club Gallery</h1>
        <p className="text-red-500">Error loading gallery images. Please try again later.</p>
      </div>
    );
  }
}




