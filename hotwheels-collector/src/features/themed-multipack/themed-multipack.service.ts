import prisma from '@/db';
import { Prisma } from '@prisma/client';

export interface ThemedMultipackFilters {
  collectionName?: string;
  collectionId?: number;
  year?: number;
  themeName?: string;
  packageCode?: string;
}

export async function getThemedMultipacks(filters: ThemedMultipackFilters) {
  const where: Prisma.ThemedMultipackWhereInput = {};

  if (filters.collectionId) {
    where.collectionId = filters.collectionId;
  }

  if (filters.collectionName) {
    where.collection = {
      name: filters.collectionName,
      ...(filters.year
        ? {
            year: {
              year: filters.year,
            },
          }
        : {}),
    };
  } else if (filters.year) {
    // Fallback: filter by year field on multipack itself
    where.year = filters.year;
  }

  if (filters.themeName) {
    where.themeName = filters.themeName;
  }

  if (filters.packageCode) {
    where.packageCode = filters.packageCode;
  }

  const multipacks = await prisma.themedMultipack.findMany({
    where,
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      items: {
        orderBy: {
          position: 'asc',
        },
        include: {
          variant: {
            include: {
              model: {
                include: {
                  subSeries: {
                    include: {
                      collection: {
                        include: {
                          year: true,
                        },
                      },
                    },
                  },
                  images: {
                    orderBy: {
                      id: 'asc',
                    },
                  },
                },
              },
              images: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
          model: {
            include: {
              subSeries: {
                include: {
                  collection: {
                    include: {
                      year: true,
                    },
                  },
                },
              },
              images: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { year: 'desc' },
      { packageCode: 'asc' },
    ],
  });

  return multipacks;
}

export async function getThemedMultipackById(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new Error('Invalid themed multipack ID');
  }

  const multipack = await prisma.themedMultipack.findUnique({
    where: { id },
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      items: {
        orderBy: {
          position: 'asc',
        },
        include: {
          variant: {
            include: {
              model: {
                include: {
                  subSeries: {
                    include: {
                      collection: {
                        include: {
                          year: true,
                        },
                      },
                    },
                  },
                  images: {
                    orderBy: {
                      id: 'asc',
                    },
                  },
                },
              },
              images: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
          model: {
            include: {
              subSeries: {
                include: {
                  collection: {
                    include: {
                      year: true,
                    },
                  },
                },
              },
              images: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
        },
      },
    },
  });

  if (!multipack) {
    throw new Error('Themed multipack not found');
  }

  return multipack;
}

export interface VariantMultipackInfo {
  id: number;
  packageCode: string;
  themeName: string;
  year: number;
  collectionId: number;
  collectionName: string;
}

export async function getMultipacksForVariant(
  variantId: number,
): Promise<VariantMultipackInfo[]> {
  if (!variantId || Number.isNaN(variantId) || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }

  const items = await prisma.themedMultipackItem.findMany({
    where: {
      variantId,
    },
    include: {
      multipack: {
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      },
    },
  });

  // Map to a compact structure for the UI
  const seenIds = new Set<number>();

  const result: VariantMultipackInfo[] = [];

  for (const item of items) {
    const mp = item.multipack;
    if (!mp || seenIds.has(mp.id)) continue;
    seenIds.add(mp.id);

    result.push({
      id: mp.id,
      packageCode: mp.packageCode,
      themeName: mp.themeName,
      year: mp.year,
      collectionId: mp.collectionId,
      collectionName: mp.collection.name,
    });
  }

  // Sort by year desc, then packageCode asc
  result.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.packageCode.localeCompare(b.packageCode);
  });

  return result;
}

