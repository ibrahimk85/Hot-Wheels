import prisma from '@/db';

export interface DuplicateGroup {
  type: 'model' | 'variant';
  entities: Array<{
    id: number;
    name: string;
    details: Record<string, any>;
  }>;
  similarity: number; // 0-100
  suggestedMerge?: {
    keepId: number;
    mergeIds: number[];
  };
}

/**
 * Duplicate model detection
 */
export async function findDuplicateModels(
  threshold: number = 0.8
): Promise<DuplicateGroup[]> {
  const models = await prisma.model.findMany({
    include: {
      collection: {
        include: {
          year: true,
        },
      },
      subSeries: true,
    },
  });

  const duplicates: DuplicateGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < models.length; i++) {
    if (processed.has(models[i].id)) continue;

    const group: DuplicateGroup = {
      type: 'model',
      entities: [],
      similarity: 100,
    };

    // Aynı castingName ve collection'a sahip modeller
    const similar = models.filter(
      (m) =>
        !processed.has(m.id) &&
        m.castingName.toLowerCase() === models[i].castingName.toLowerCase() &&
        m.collectionId === models[i].collectionId
    );

    if (similar.length > 1) {
      for (const model of similar) {
        group.entities.push({
          id: model.id,
          name: model.castingName,
          details: {
            collection: model.collection.name,
            year: model.collection.year.year,
            subSeries: model.subSeries?.name,
            castingId: model.castingId,
            owned: model.owned,
            variantsCount: 0, // Will be filled later
          },
        });
        processed.add(model.id);
      }

      // En çok variant'a sahip olanı keep olarak öner
      const variantsCounts = await Promise.all(
        group.entities.map(async (e) => {
          const count = await prisma.variant.count({
            where: { modelId: e.id },
          });
          return { id: e.id, count };
        })
      );

      const sorted = variantsCounts.sort((a, b) => b.count - a.count);
      group.suggestedMerge = {
        keepId: sorted[0].id,
        mergeIds: sorted.slice(1).map((s) => s.id),
      };

      // Update details with variant counts
      for (const entity of group.entities) {
        const count = variantsCounts.find((c) => c.id === entity.id)?.count || 0;
        entity.details.variantsCount = count;
      }

      duplicates.push(group);
    }
  }

  return duplicates;
}

/**
 * Duplicate variant detection
 */
export async function findDuplicateVariants(
  threshold: number = 0.8
): Promise<DuplicateGroup[]> {
  const variants = await prisma.variant.findMany({
    include: {
      model: {
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

  const duplicates: DuplicateGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < variants.length; i++) {
    if (processed.has(variants[i].id)) continue;

    // Aynı model, cardNumber ve color'a sahip variant'lar
    const similar = variants.filter(
      (v) =>
        !processed.has(v.id) &&
        v.modelId === variants[i].modelId &&
        v.cardNumber === variants[i].cardNumber &&
        v.color === variants[i].color
    );

    if (similar.length > 1) {
      const group: DuplicateGroup = {
        type: 'variant',
        entities: [],
        similarity: 100,
      };

      for (const variant of similar) {
        group.entities.push({
          id: variant.id,
          name: `${variant.model.castingName} - ${variant.cardNumber || 'N/A'}`,
          details: {
            model: variant.model.castingName,
            collection: variant.model.collection.name,
            year: variant.model.collection.year.year,
            cardNumber: variant.cardNumber,
            color: variant.color,
            owned: variant.owned,
            quantity: variant.quantity,
          },
        });
        processed.add(variant.id);
      }

      // En çok bilgiye sahip olanı keep olarak öner
      const sorted = similar.sort((a, b) => {
        const aInfo = [
          a.color,
          a.cardNumber,
          a.notes,
          a.condition,
        ].filter(Boolean).length;
        const bInfo = [
          b.color,
          b.cardNumber,
          b.notes,
          b.condition,
        ].filter(Boolean).length;
        return bInfo - aInfo;
      });

      group.suggestedMerge = {
        keepId: sorted[0].id,
        mergeIds: sorted.slice(1).map((s) => s.id),
      };

      duplicates.push(group);
    }
  }

  return duplicates;
}

/**
 * Merge duplicate models
 */
export async function mergeModels(
  keepId: number,
  mergeIds: number[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Keep model'i al
    const keepModel = await prisma.model.findUnique({
      where: { id: keepId },
    });

    if (!keepModel) {
      return { success: false, message: 'Keep model bulunamadı' };
    }

    // Merge edilecek modellerin variant'larını keep model'e taşı
    for (const mergeId of mergeIds) {
      await prisma.variant.updateMany({
        where: { modelId: mergeId },
        data: { modelId: keepId },
      });

      // Keep model'in bilgilerini güncelle (merge model'de daha iyi bilgi varsa)
      const mergeModel = await prisma.model.findUnique({
        where: { id: mergeId },
      });

      if (mergeModel) {
        const updates: any = {};
        if (!keepModel.castingId && mergeModel.castingId) {
          updates.castingId = mergeModel.castingId;
        }
        if (!keepModel.description && mergeModel.description) {
          updates.description = mergeModel.description;
        }
        if (!keepModel.notes && mergeModel.notes) {
          updates.notes = mergeModel.notes;
        }
        if (mergeModel.owned && !keepModel.owned) {
          updates.owned = true;
        }
        if (mergeModel.quantity > keepModel.quantity) {
          updates.quantity = mergeModel.quantity;
        }

        if (Object.keys(updates).length > 0) {
          await prisma.model.update({
            where: { id: keepId },
            data: updates,
          });
        }

        // Merge model'i sil
        await prisma.model.delete({
          where: { id: mergeId },
        });
      }
    }

    return {
      success: true,
      message: `${mergeIds.length} model başarıyla birleştirildi`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Merge hatası: ${error.message}`,
    };
  }
}

/**
 * Merge duplicate variants
 */
export async function mergeVariants(
  keepId: number,
  mergeIds: number[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Keep variant'ı al
    const keepVariant = await prisma.variant.findUnique({
      where: { id: keepId },
    });

    if (!keepVariant) {
      return { success: false, message: 'Keep variant bulunamadı' };
    }

    // Merge edilecek variant'ların bilgilerini birleştir
    for (const mergeId of mergeIds) {
      const mergeVariant = await prisma.variant.findUnique({
        where: { id: mergeId },
      });

      if (mergeVariant) {
        const updates: any = {};
        if (!keepVariant.color && mergeVariant.color) {
          updates.color = mergeVariant.color;
        }
        if (!keepVariant.cardNumber && mergeVariant.cardNumber) {
          updates.cardNumber = mergeVariant.cardNumber;
        }
        if (!keepVariant.notes && mergeVariant.notes) {
          updates.notes = mergeVariant.notes;
        }
        if (!keepVariant.condition && mergeVariant.condition) {
          updates.condition = mergeVariant.condition;
        }
        if (mergeVariant.owned && !keepVariant.owned) {
          updates.owned = true;
        }
        updates.quantity = (keepVariant.quantity || 0) + (mergeVariant.quantity || 0);

        if (Object.keys(updates).length > 0) {
          await prisma.variant.update({
            where: { id: keepId },
            data: updates,
          });
        }

        // Merge variant'ın image'lerini keep variant'a taşı
        await prisma.image.updateMany({
          where: { variantId: mergeId },
          data: { variantId: keepId },
        });

        // Merge variant'ı sil
        await prisma.variant.delete({
          where: { id: mergeId },
        });
      }
    }

    return {
      success: true,
      message: `${mergeIds.length} variant başarıyla birleştirildi`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Merge hatası: ${error.message}`,
    };
  }
}



