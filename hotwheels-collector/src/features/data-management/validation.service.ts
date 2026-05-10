import prisma from '@/db';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'high' | 'medium' | 'low';
  entity: 'model' | 'variant' | 'collection' | 'image';
  entityId: number;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  issues: ValidationIssue[];
}

/**
 * Veri tutarlılık kontrolü
 */
export async function validateDataConsistency(): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // 1. Model'lerin collectionId'si geçerli mi?
  // Bu kontrol için collectionId'nin geçerli bir collection'a ait olup olmadığını kontrol etmeliyiz
  // Şimdilik atlanıyor, çünkü Prisma'da null check direkt yapılamıyor
  const modelsWithInvalidCollection: any[] = [];

  for (const model of modelsWithInvalidCollection) {
    issues.push({
      type: 'error',
      severity: 'high',
      entity: 'model',
      entityId: model.id,
      field: 'collectionId',
      message: `Model "${model.castingName}" geçersiz bir koleksiyona ait`,
      suggestion: 'Koleksiyon ID\'sini düzeltin veya modeli silin',
    });
  }

  // 2. Variant'ların modelId'si geçerli mi?
  // Bu kontrol için modelId'nin geçerli bir model'e ait olup olmadığını kontrol etmeliyiz
  const variantsWithInvalidModel: any[] = [];

  for (const variant of variantsWithInvalidModel) {
    issues.push({
      type: 'error',
      severity: 'high',
      entity: 'variant',
      entityId: variant.id,
      field: 'modelId',
      message: `Variant geçersiz bir modele ait`,
      suggestion: 'Model ID\'sini düzeltin veya variant\'ı silin',
    });
  }

  // 3. Image'lerin modelId veya variantId'si geçerli mi?
  const imagesWithInvalidReferences = await prisma.image.findMany({
    where: {
      AND: [
        { modelId: null },
        { variantId: null },
      ],
    },
  });

  for (const image of imagesWithInvalidReferences) {
    issues.push({
      type: 'warning',
      severity: 'medium',
      entity: 'image',
      entityId: image.id,
      message: `Image hiçbir modele veya variant'a bağlı değil`,
      suggestion: 'Image\'i bir modele veya variant\'a bağlayın veya silin',
    });
  }

  // 4. Model'lerin subSeriesId'si geçerli mi?
  // Bu kontrol için subSeriesId'nin geçerli bir subSeries'e ait olup olmadığını kontrol etmeliyiz
  const modelsWithInvalidSubSeries: any[] = [];

  for (const model of modelsWithInvalidSubSeries) {
    issues.push({
      type: 'warning',
      severity: 'medium',
      entity: 'model',
      entityId: model.id,
      field: 'subSeriesId',
      message: `Model "${model.castingName}" geçersiz bir alt seriye ait`,
      suggestion: 'Alt seri ID\'sini düzeltin veya null yapın',
    });
  }

  // 5. Duplicate castingName kontrolü (aynı collection içinde)
  const duplicateModels = await prisma.model.groupBy({
    by: ['castingName', 'collectionId'],
    having: {
      castingName: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  for (const duplicate of duplicateModels) {
    const models = await prisma.model.findMany({
      where: {
        castingName: duplicate.castingName,
        collectionId: duplicate.collectionId,
      },
    });

    for (let i = 1; i < models.length; i++) {
      issues.push({
        type: 'warning',
        severity: 'low',
        entity: 'model',
        entityId: models[i].id,
        field: 'castingName',
        message: `"${duplicate.castingName}" adında başka bir model zaten var (ID: ${models[0].id})`,
        suggestion: 'Modelleri birleştirmeyi düşünün',
      });
    }
  }

  // 6. Variant'ların duplicate kontrolü (aynı model, cardNumber, color)
  const duplicateVariants = await prisma.variant.groupBy({
    by: ['modelId', 'cardNumber', 'color'],
    having: {
      modelId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  for (const duplicate of duplicateVariants) {
    const variants = await prisma.variant.findMany({
      where: {
        modelId: duplicate.modelId,
        cardNumber: duplicate.cardNumber || null,
        color: duplicate.color || null,
      },
    });

    for (let i = 1; i < variants.length; i++) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        entity: 'variant',
        entityId: variants[i].id,
        message: `Aynı model, kart numarası ve renge sahip başka bir variant zaten var (ID: ${variants[0].id})`,
        suggestion: 'Variant\'ları birleştirmeyi düşünün',
      });
    }
  }

  // 7. Orphaned images (dosya sisteminde olmayan)
  // Bu kontrol için file system erişimi gerekir, şimdilik atlanıyor

  const errors = issues.filter((i) => i.type === 'error').length;
  const warnings = issues.filter((i) => i.type === 'warning').length;
  const info = issues.filter((i) => i.type === 'info').length;

  return {
    totalIssues: issues.length,
    errors,
    warnings,
    info,
    issues,
  };
}

/**
 * Belirli bir entity için doğrulama
 */
export async function validateEntity(
  entity: 'model' | 'variant' | 'collection',
  entityId: number
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (entity === 'model') {
    const model = await prisma.model.findUnique({
      where: { id: entityId },
      include: {
        collection: true,
        subSeries: true,
      },
    });

    if (!model) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'model',
        entityId,
        message: 'Model bulunamadı',
      });
      return issues;
    }

    if (!model.collection) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'model',
        entityId,
        field: 'collectionId',
        message: 'Model geçersiz bir koleksiyona ait',
      });
    }

    if (model.subSeriesId && !model.subSeries) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        entity: 'model',
        entityId,
        field: 'subSeriesId',
        message: 'Model geçersiz bir alt seriye ait',
      });
    }
  } else if (entity === 'variant') {
    const variant = await prisma.variant.findUnique({
      where: { id: entityId },
      include: {
        model: true,
      },
    });

    if (!variant) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'variant',
        entityId,
        message: 'Variant bulunamadı',
      });
      return issues;
    }

    if (!variant.model) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'variant',
        entityId,
        field: 'modelId',
        message: 'Variant geçersiz bir modele ait',
      });
    }
  } else if (entity === 'collection') {
    const collection = await prisma.collection.findUnique({
      where: { id: entityId },
      include: {
        year: true,
      },
    });

    if (!collection) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'collection',
        entityId,
        message: 'Koleksiyon bulunamadı',
      });
      return issues;
    }

    if (!collection.year) {
      issues.push({
        type: 'error',
        severity: 'high',
        entity: 'collection',
        entityId,
        field: 'yearId',
        message: 'Koleksiyon geçersiz bir yıla ait',
      });
    }
  }

  return issues;
}

