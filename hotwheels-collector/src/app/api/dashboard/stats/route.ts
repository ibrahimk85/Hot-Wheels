import { NextResponse } from 'next/server';
import prisma from '@/db';
import { getMarketPrice } from '@/features/analytics/price-helper';

export async function GET() {
  try {
    // Get owned variants first to find which models are owned
    const ownedVariants = await prisma.variant.findMany({
      where: { owned: true },
      select: { modelId: true },
      distinct: ['modelId'],
    });

    const ownedModelIds = ownedVariants.map(v => v.modelId);

    const [totalModels, totalVariants, ownedVariantsCount, wishlistedVariantsCount, valueData] = await Promise.all([
      prisma.model.count(),
      prisma.variant.count(),
      prisma.variant.count({ where: { owned: true } }),
      prisma.variant.count({ where: { wishlisted: true } }),
      // Get models with all price fields for calculation
      prisma.model.findMany({
        where: {
          id: { in: ownedModelIds },
        },
        select: {
          packedMarketPrice: true,
          looseMarketPrice: true,
          packedPurchasePrice: true,
          loosePurchasePrice: true,
          // Fallback to old fields if new ones are null
          packedPrice: true,
          loosePrice: true,
        },
      }),
    ]);

    // Calculate collection value using market prices
    const collectionValue = valueData.reduce((sum: number, model: any) => {
      return sum + getMarketPrice(model);
    }, 0);

    return NextResponse.json({
      totalModels,
      totalVariants,
      ownedVariants: ownedVariantsCount,
      wishlistedVariants: wishlistedVariantsCount,
      collectionValue,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

