import prisma from '@/db';

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: Record<string, any> | null;
  timestamp: Date;
}

/**
 * Audit log oluştur
 */
export async function createAuditLog(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  changes: Record<string, any> | null = null
): Promise<void> {
  // CollectionHistory kullanarak audit log oluştur
  if (entityType === 'collection' || entityType === 'model' || entityType === 'variant') {
    await prisma.collectionHistory.create({
      data: {
        userId,
        collectionId: entityType === 'collection' ? entityId : null,
        action,
        entityType,
        entityId: entityType !== 'collection' ? entityId : null,
        changes: changes ? JSON.stringify(changes) : null,
      },
    });
  }
}

/**
 * Audit log'ları getir
 */
export async function getAuditLogs(
  filters?: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<AuditLog[]> {
  const where: any = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters?.entityId) {
    where.entityId = filters.entityId;
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const logs = await prisma.collectionHistory.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: filters?.limit || 100,
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    changes: log.changes ? JSON.parse(log.changes) : null,
    timestamp: log.createdAt,
  }));
}

/**
 * Entity için audit log'ları getir
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: number
): Promise<AuditLog[]> {
  return getAuditLogs({
    entityType,
    entityId,
    limit: 50,
  });
}

