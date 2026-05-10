import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import { parseCSVFile, parseExcelFile, matchImportRows, MatchedVariant } from '@/features/data-management/import.service';

export interface ImportRequest {
  preview: Array<{
    rowIndex: number;
    importData: any;
    currentData: any;
    matchStatus: 'matched' | 'unmatched' | 'error';
    changes: Array<{
      field: string;
      current: any;
      new: any;
      willChange: boolean;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { preview } = body;

    if (!preview || preview.length === 0) {
      return NextResponse.json(
        { error: 'No preview data provided' },
        { status: 400 }
      );
    }

    // Filter only matched rows with changes
    const rowsToImport = preview.filter(
      (row) => row.matchStatus === 'matched' && row.changes.some((c) => c.willChange)
    );

    if (rowsToImport.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to import',
        updated: 0,
        errors: [],
      });
    }

    // Import in transaction
    const result = await prisma.$transaction(async (tx) => {
      let updatedVariants = 0;
      let updatedModels = 0;
      const errors: Array<{ rowIndex: number; error: string }> = [];

      // Group by variant and model to batch updates
      const variantUpdates = new Map<number, any>();
      const modelUpdates = new Map<number, any>();

      for (const row of rowsToImport) {
        try {
          const variantId = row.currentData?.variant?.id;
          const modelId = row.currentData?.model?.id;

          if (!variantId || !modelId) {
            errors.push({
              rowIndex: row.rowIndex,
              error: 'Missing variant or model ID',
            });
            continue;
          }

          // Collect variant updates
          if (!variantUpdates.has(variantId)) {
            variantUpdates.set(variantId, {});
          }
          const variantUpdate = variantUpdates.get(variantId);

          // Collect model updates
          if (!modelUpdates.has(modelId)) {
            modelUpdates.set(modelId, {});
          }
          const modelUpdate = modelUpdates.get(modelId);

          // Apply changes
          for (const change of row.changes) {
            if (!change.willChange) continue;

            switch (change.field) {
              case 'packedOwned':
                variantUpdate.packedOwned = change.new;
                break;
              case 'looseOwned':
                variantUpdate.looseOwned = change.new;
                break;
              case 'wishlisted':
                variantUpdate.wishlisted = change.new;
                break;
              case 'quantity':
                variantUpdate.quantity = change.new;
                break;
              case 'variantNotes':
                variantUpdate.notes = change.new;
                break;
              case 'condition':
                variantUpdate.condition = change.new;
                break;
              case 'packedPurchasePrice':
                modelUpdate.packedPurchasePrice = change.new;
                break;
              case 'packedMarketPrice':
                modelUpdate.packedMarketPrice = change.new;
                break;
              case 'packedOriginalPrice':
                modelUpdate.packedOriginalPrice = change.new;
                break;
              case 'loosePurchasePrice':
                modelUpdate.loosePurchasePrice = change.new;
                break;
              case 'looseMarketPrice':
                modelUpdate.looseMarketPrice = change.new;
                break;
              case 'modelNotes':
                modelUpdate.notes = change.new;
                break;
            }
          }
        } catch (error) {
          errors.push({
            rowIndex: row.rowIndex,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Apply variant updates
      for (const [variantId, update] of variantUpdates.entries()) {
        try {
          await tx.variant.update({
            where: { id: variantId },
            data: update,
          });
          updatedVariants++;
        } catch (error) {
          errors.push({
            rowIndex: -1, // Batch update, no specific row
            error: `Failed to update variant ${variantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      // Apply model updates
      for (const [modelId, update] of modelUpdates.entries()) {
        try {
          await tx.model.update({
            where: { id: modelId },
            data: update,
          });
          updatedModels++;
        } catch (error) {
          errors.push({
            rowIndex: -1, // Batch update, no specific row
            error: `Failed to update model ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      return {
        updatedVariants,
        updatedModels,
        errors,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Import completed: ${result.updatedVariants} variants and ${result.updatedModels} models updated`,
      updatedVariants: result.updatedVariants,
      updatedModels: result.updatedModels,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

