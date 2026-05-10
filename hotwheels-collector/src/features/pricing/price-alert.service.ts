import prisma from '@/db';
import { getPriceHistoryForModel, getPriceHistoryForVariant } from '@/features/integrations/integration.service';

export interface PriceAlertData {
  id: number;
  userId: number | null;
  variantId: number | null;
  modelId: number | null;
  targetPrice: number;
  condition: 'below' | 'above' | 'equal';
  active: boolean;
  notified: boolean;
  createdAt: Date;
  triggeredAt: Date | null;
}

/**
 * Fiyat uyarısı oluştur
 */
export async function createPriceAlert(
  data: {
    userId?: number;
    variantId?: number;
    modelId?: number;
    targetPrice: number;
    condition: 'below' | 'above' | 'equal';
  }
): Promise<PriceAlertData> {
  const alert = await prisma.priceAlert.create({
    data: {
      userId: data.userId || null,
      variantId: data.variantId || null,
      modelId: data.modelId || null,
      targetPrice: data.targetPrice,
      condition: data.condition,
      active: true,
      notified: false,
    },
  });

  return {
    id: alert.id,
    userId: alert.userId,
    variantId: alert.variantId,
    modelId: alert.modelId,
    targetPrice: alert.targetPrice,
    condition: alert.condition as 'below' | 'above' | 'equal',
    active: alert.active,
    notified: alert.notified,
    createdAt: alert.createdAt,
    triggeredAt: alert.triggeredAt,
  };
}

/**
 * Kullanıcının fiyat uyarılarını getir
 */
export async function getUserPriceAlerts(
  userId: number,
  activeOnly: boolean = true
): Promise<PriceAlertData[]> {
  const where: any = { userId };
  if (activeOnly) {
    where.active = true;
  }

  const alerts = await prisma.priceAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    userId: alert.userId,
    variantId: alert.variantId,
    modelId: alert.modelId,
    targetPrice: alert.targetPrice,
    condition: alert.condition as 'below' | 'above' | 'equal',
    active: alert.active,
    notified: alert.notified,
    createdAt: alert.createdAt,
    triggeredAt: alert.triggeredAt,
  }));
}

/**
 * Fiyat uyarısını güncelle
 */
export async function updatePriceAlert(
  id: number,
  data: {
    targetPrice?: number;
    condition?: 'below' | 'above' | 'equal';
    active?: boolean;
  }
): Promise<PriceAlertData> {
  const updateData: any = {};
  if (data.targetPrice !== undefined) updateData.targetPrice = data.targetPrice;
  if (data.condition !== undefined) updateData.condition = data.condition;
  if (data.active !== undefined) updateData.active = data.active;

  const alert = await prisma.priceAlert.update({
    where: { id },
    data: updateData,
  });

  return {
    id: alert.id,
    userId: alert.userId,
    variantId: alert.variantId,
    modelId: alert.modelId,
    targetPrice: alert.targetPrice,
    condition: alert.condition as 'below' | 'above' | 'equal',
    active: alert.active,
    notified: alert.notified,
    createdAt: alert.createdAt,
    triggeredAt: alert.triggeredAt,
  };
}

/**
 * Fiyat uyarısını sil
 */
export async function deletePriceAlert(id: number): Promise<void> {
  await prisma.priceAlert.delete({
    where: { id },
  });
}

/**
 * Fiyat uyarılarını kontrol et (scheduled job için)
 */
export async function checkPriceAlerts(): Promise<PriceAlertData[]> {
  const activeAlerts = await prisma.priceAlert.findMany({
    where: {
      active: true,
      notified: false,
    },
  });

  const triggeredAlerts: PriceAlertData[] = [];

  for (const alert of activeAlerts) {
    let currentPrice: number | null = null;

    // Mevcut fiyatı al
    if (alert.variantId) {
      const history = await getPriceHistoryForVariant(alert.variantId);
      if (history.length > 0) {
        const latest = history.sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        )[0];
        currentPrice = latest.price;
      }
    } else if (alert.modelId) {
      const history = await getPriceHistoryForModel(alert.modelId);
      if (history.length > 0) {
        const latest = history.sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        )[0];
        currentPrice = latest.price;
      }
    }

    if (currentPrice === null) {
      continue;
    }

    // Koşulu kontrol et
    let triggered = false;
    switch (alert.condition) {
      case 'below':
        triggered = currentPrice <= alert.targetPrice;
        break;
      case 'above':
        triggered = currentPrice >= alert.targetPrice;
        break;
      case 'equal':
        triggered = Math.abs(currentPrice - alert.targetPrice) < 0.01;
        break;
    }

    if (triggered) {
      // Uyarıyı tetikle
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          notified: true,
          triggeredAt: new Date(),
        },
      });

      triggeredAlerts.push({
        id: alert.id,
        userId: alert.userId,
        variantId: alert.variantId,
        modelId: alert.modelId,
        targetPrice: alert.targetPrice,
        condition: alert.condition as 'below' | 'above' | 'equal',
        active: alert.active,
        notified: true,
        createdAt: alert.createdAt,
        triggeredAt: new Date(),
      });
    }
  }

  return triggeredAlerts;
}



