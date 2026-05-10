import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';

/**
 * API Endpoint: Get years for a SubSeries
 * 
 * For Silver Series: Returns unique years from variants of the selected SubSeries
 * For other collections: Returns years from collections that have this SubSeries
 * 
 * Query params:
 *   - collectionId: Collection ID (optional, for non-Silver Series)
 *   - subSeriesId: SubSeries ID (optional)
 *   - subSeriesName: SubSeries name (optional, for Silver Series)
 *   - collectionName: Collection name (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collectionId');
    const subSeriesId = searchParams.get('subSeriesId');
    const subSeriesName = searchParams.get('subSeriesName');
    const collectionName = searchParams.get('collectionName');

    if (!collectionName) {
      return NextResponse.json(
        { error: 'collectionName parameter is required' },
        { status: 400 }
      );
    }

    const isSilverSeries = collectionName === 'Hot Wheels Silver Series';

    if (isSilverSeries) {
      // Silver Series: Get years from variants
      if (subSeriesId) {
        // Get SubSeries by ID
        const subSeries = await prisma.subSeries.findUnique({
          where: { id: parseInt(subSeriesId) },
          include: {
            models: {
              include: {
                variants: {
                  select: {
                    year: true,
                  },
                },
              },
            },
          },
        });

        if (!subSeries) {
          return NextResponse.json({ years: [] });
        }

        // Extract unique years from variants
        const years = new Set<number>();
        for (const model of subSeries.models) {
          for (const variant of model.variants) {
            years.add(variant.year);
          }
        }

        return NextResponse.json({
          years: Array.from(years).sort((a, b) => b - a),
        });
      } else if (subSeriesName) {
        // Get SubSeries matching name or starting with "seriesName - " (e.g. "Blue and Gold (2026)" matches "Blue and Gold (2026) - Mix 1")
        const subSeriesList = await prisma.subSeries.findMany({
          where: {
            OR: [
              { name: subSeriesName },
              { name: { startsWith: subSeriesName + ' - ' } },
            ],
            collection: {
              name: 'Hot Wheels Silver Series',
            },
          },
          include: {
            models: {
              include: {
                variants: {
                  select: {
                    year: true,
                  },
                },
              },
            },
          },
        });

        // Extract unique years from all variants
        const years = new Set<number>();
        for (const subSeries of subSeriesList) {
          for (const model of subSeries.models) {
            for (const variant of model.variants) {
              years.add(variant.year);
            }
          }
        }

        return NextResponse.json({
          years: Array.from(years).sort((a, b) => b - a),
        });
      } else {
        // No SubSeries selected: Return all years from all Silver Series variants
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

        const years = allVariants.map(v => v.year).sort((a, b) => b - a);
        return NextResponse.json({ years });
      }
    } else {
      // Other collections: Get years from collections
      if (subSeriesId) {
        const subSeries = await prisma.subSeries.findUnique({
          where: { id: parseInt(subSeriesId) },
          include: {
            collection: {
              include: {
                year: true,
              },
            },
          },
        });

        if (!subSeries) {
          return NextResponse.json({ years: [] });
        }

        // For non-Silver Series, return the collection's year
        return NextResponse.json({
          years: [subSeries.collection.year.year],
        });
      } else if (subSeriesName && collectionId) {
        // Get all SubSeries with this name in this collection type
        const subSeriesList = await prisma.subSeries.findMany({
          where: {
            name: subSeriesName,
            collection: {
              name: collectionName,
            },
          },
          include: {
            collection: {
              include: {
                year: true,
              },
            },
          },
        });

        const years = subSeriesList
          .map(ss => ss.collection.year.year)
          .filter((year, index, self) => self.indexOf(year) === index)
          .sort((a, b) => b - a);

        return NextResponse.json({ years });
      } else {
        // No SubSeries selected: Return all years for this collection
        const collections = await prisma.collection.findMany({
          where: {
            name: collectionName,
          },
          include: {
            year: true,
          },
        });

        const years = collections
          .map(c => c.year.year)
          .filter((year, index, self) => self.indexOf(year) === index)
          .sort((a, b) => b - a);

        return NextResponse.json({ years });
      }
    }
  } catch (error) {
    console.error('Error fetching years for SubSeries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years' },
      { status: 500 }
    );
  }
}
