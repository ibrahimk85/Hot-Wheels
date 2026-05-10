import prisma from '@/db';

export interface DashboardLayoutData {
  id: number;
  userId: number | null;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidgetData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidgetData {
  id: number;
  layoutId: number;
  type: string;
  position: number;
  size: string;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Kullanıcının varsayılan dashboard layout'unu getir
 */
export async function getDefaultDashboardLayout(
  userId?: number
): Promise<DashboardLayoutData | null> {
  const layout = await prisma.dashboardLayout.findFirst({
    where: {
      isDefault: true,
      userId: userId || null,
    },
    include: {
      widgets: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!layout) {
    return null;
  }

  return {
    ...layout,
    widgets: layout.widgets.map((w) => ({
      ...w,
      config: w.config ? JSON.parse(w.config) : {},
    })),
  };
}

/**
 * Tüm dashboard layout'larını getir
 */
export async function getAllDashboardLayouts(
  userId?: number
): Promise<DashboardLayoutData[]> {
  const layouts = await prisma.dashboardLayout.findMany({
    where: {
      userId: userId || null,
    },
    include: {
      widgets: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return layouts.map((layout) => ({
    ...layout,
    widgets: layout.widgets.map((w) => ({
      ...w,
      config: w.config ? JSON.parse(w.config) : {},
    })),
  }));
}

/**
 * Dashboard layout oluştur
 */
export async function createDashboardLayout(
  name: string,
  userId?: number,
  isDefault: boolean = false
): Promise<DashboardLayoutData> {
  // Eğer default ise, diğer default'ları kaldır
  if (isDefault) {
    await prisma.dashboardLayout.updateMany({
      where: {
        userId: userId || null,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  const layout = await prisma.dashboardLayout.create({
    data: {
      name,
      userId: userId || null,
      isDefault,
    },
    include: {
      widgets: true,
    },
  });

  return {
    ...layout,
    widgets: [],
  };
}

/**
 * Dashboard layout güncelle
 */
export async function updateDashboardLayout(
  id: number,
  data: {
    name?: string;
    isDefault?: boolean;
  }
): Promise<DashboardLayoutData> {
  // Eğer default yapılıyorsa, diğer default'ları kaldır
  if (data.isDefault) {
    const layout = await prisma.dashboardLayout.findUnique({ where: { id } });
    if (layout) {
      await prisma.dashboardLayout.updateMany({
        where: {
          userId: layout.userId,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }
  }

  const layout = await prisma.dashboardLayout.update({
    where: { id },
    data,
    include: {
      widgets: {
        orderBy: { position: 'asc' },
      },
    },
  });

  return {
    ...layout,
    widgets: layout.widgets.map((w) => ({
      ...w,
      config: w.config ? JSON.parse(w.config) : {},
    })),
  };
}

/**
 * Dashboard layout sil
 */
export async function deleteDashboardLayout(id: number): Promise<void> {
  await prisma.dashboardLayout.delete({
    where: { id },
  });
}

/**
 * Widget ekle
 */
export async function addWidget(
  layoutId: number,
  widget: {
    type: string;
    position: number;
    size: string;
    config: Record<string, any>;
  }
): Promise<DashboardWidgetData> {
  const created = await prisma.dashboardWidget.create({
    data: {
      layoutId,
      type: widget.type,
      position: widget.position,
      size: widget.size,
      config: JSON.stringify(widget.config),
    },
  });

  return {
    ...created,
    config: widget.config,
  };
}

/**
 * Widget güncelle
 */
export async function updateWidget(
  id: number,
  data: {
    type?: string;
    position?: number;
    size?: string;
    config?: Record<string, any>;
  }
): Promise<DashboardWidgetData> {
  const updateData: any = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.size !== undefined) updateData.size = data.size;
  if (data.config !== undefined) updateData.config = JSON.stringify(data.config);

  const updated = await prisma.dashboardWidget.update({
    where: { id },
    data: updateData,
  });

  return {
    ...updated,
    config: updated.config ? JSON.parse(updated.config) : {},
  };
}

/**
 * Widget sil
 */
export async function deleteWidget(id: number): Promise<void> {
  await prisma.dashboardWidget.delete({
    where: { id },
  });
}

/**
 * Widget'ları yeniden sırala
 */
export async function reorderWidgets(
  layoutId: number,
  widgetPositions: Array<{ id: number; position: number }>
): Promise<void> {
  await prisma.$transaction(
    widgetPositions.map((wp) =>
      prisma.dashboardWidget.update({
        where: { id: wp.id },
        data: { position: wp.position },
      })
    )
  );
}

/**
 * Varsayılan dashboard layout oluştur (ilk kurulum için)
 */
export async function createDefaultDashboardLayout(
  userId?: number
): Promise<DashboardLayoutData> {
  // Varsayılan widget'lar
  const defaultWidgets = [
    {
      type: 'stats',
      position: 0,
      size: '2x1',
      config: { title: 'Koleksiyon Özeti', showTotalModels: true, showTotalVariants: true },
    },
    {
      type: 'chart',
      position: 1,
      size: '2x2',
      config: { title: 'Koleksiyon Dağılımı', chartType: 'pie' },
    },
    {
      type: 'collection',
      position: 2,
      size: '2x1',
      config: { title: 'Son Eklenenler', limit: 5 },
    },
    {
      type: 'goal',
      position: 3,
      size: '2x1',
      config: { title: 'Aktif Hedefler', limit: 3 },
    },
  ];

  const layout = await createDashboardLayout('Varsayılan Dashboard', userId, true);

  // Widget'ları ekle
  for (const widget of defaultWidgets) {
    await addWidget(layout.id, widget);
  }

  const result = await getDefaultDashboardLayout(userId);
  return result || layout;
}

