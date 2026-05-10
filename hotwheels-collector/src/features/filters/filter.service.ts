import prisma from '@/db';

export interface SavedFilterData {
  id: number;
  name: string;
  filterData: string;
  type: string; // 'variants' | 'models'
  createdAt: Date;
}

/**
 * Tüm kayıtlı filtreleri getirir
 */
export async function getAllSavedFilters(
  type?: 'variants' | 'models'
): Promise<SavedFilterData[]> {
  const where = type ? { type } : {};
  return prisma.savedFilter.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Belirli bir kayıtlı filtreyi getirir
 */
export async function getSavedFilterById(
  id: number
): Promise<SavedFilterData | null> {
  return prisma.savedFilter.findUnique({
    where: { id },
  });
}

/**
 * Yeni kayıtlı filtre oluşturur
 */
export async function createSavedFilter(data: {
  name: string;
  filterData: string;
  type: 'variants' | 'models';
}): Promise<SavedFilterData> {
  return prisma.savedFilter.create({
    data,
  });
}

/**
 * Kayıtlı filtreyi günceller
 */
export async function updateSavedFilter(
  id: number,
  data: {
    name?: string;
    filterData?: string;
  }
): Promise<SavedFilterData> {
  return prisma.savedFilter.update({
    where: { id },
    data,
  });
}

/**
 * Kayıtlı filtreyi siler
 */
export async function deleteSavedFilter(id: number): Promise<boolean> {
  try {
    await prisma.savedFilter.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Error deleting saved filter:', error);
    return false;
  }
}

