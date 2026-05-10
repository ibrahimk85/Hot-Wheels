import { NextRequest, NextResponse } from 'next/server';
import { parseCSVFile, parseExcelFile, matchImportRows, getCurrentValues, ImportRow, MatchedVariant } from '@/features/data-management/import.service';

export interface PreviewResponse {
  totalRows: number;
  matched: number;
  unmatched: number;
  preview: Array<{
    rowIndex: number;
    importData: ImportRow;
    currentData: {
      variant: {
        id: number;
        packedOwned: boolean;
        looseOwned: boolean;
        wishlisted: boolean;
        quantity: number;
        notes: string | null;
        condition: string | null;
      };
      model: {
        id: number;
        packedPurchasePrice: number | null;
        packedMarketPrice: number | null;
        packedOriginalPrice: number | null;
        loosePurchasePrice: number | null;
        looseMarketPrice: number | null;
        notes: string | null;
      };
    } | null;
    matchStatus: 'matched' | 'unmatched' | 'error';
    matchMethod?: 'variantId' | 'toyNumber' | 'cardNumber';
    changes: Array<{
      field: string;
      current: any;
      new: any;
      willChange: boolean;
    }>;
  }>;
  errors: Array<{ rowIndex: number; error: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse file based on extension
    const fileName = file.name.toLowerCase();
    let rows: ImportRow[] = [];

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      rows = parseCSVFile(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      rows = parseExcelFile(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please use CSV or Excel (.xlsx, .xls)' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      );
    }

    // Debug: Log first row to see what was parsed
    if (rows.length > 0) {
      console.log('First import row sample:', JSON.stringify(rows[0], null, 2));
    }

    // Match rows to variants
    const matchResult = await matchImportRows(rows);

    // Get current values for matched variants
    const currentValues = await getCurrentValues(matchResult.matchedVariants);

    // Build preview data
    const preview: PreviewResponse['preview'] = [];

    // Process matched variants
    for (let i = 0; i < matchResult.matchedVariants.length; i++) {
      const matched = matchResult.matchedVariants[i];
      const variant = currentValues.variants.get(matched.variantId);
      const model = currentValues.models.get(matched.modelId);

      if (!variant || !model) continue;

      const changes: Array<{
        field: string;
        current: any;
        new: any;
        willChange: boolean;
      }> = [];

      // Compare variant fields
      if (matched.importData.packedOwned !== undefined && matched.importData.packedOwned !== variant.packedOwned) {
        changes.push({
          field: 'packedOwned',
          current: variant.packedOwned,
          new: matched.importData.packedOwned,
          willChange: true,
        });
      }

      if (matched.importData.looseOwned !== undefined && matched.importData.looseOwned !== variant.looseOwned) {
        changes.push({
          field: 'looseOwned',
          current: variant.looseOwned,
          new: matched.importData.looseOwned,
          willChange: true,
        });
      }

      if (matched.importData.wishlisted !== undefined && matched.importData.wishlisted !== variant.wishlisted) {
        changes.push({
          field: 'wishlisted',
          current: variant.wishlisted,
          new: matched.importData.wishlisted,
          willChange: true,
        });
      }

      if (matched.importData.quantity !== undefined && matched.importData.quantity !== variant.quantity) {
        changes.push({
          field: 'quantity',
          current: variant.quantity,
          new: matched.importData.quantity,
          willChange: true,
        });
      }

      if (matched.importData.variantNotes !== undefined) {
        const currentNotes = variant.notes || '';
        const newNotes = matched.importData.variantNotes || '';
        if (currentNotes !== newNotes) {
          changes.push({
            field: 'variantNotes',
            current: variant.notes,
            new: matched.importData.variantNotes,
            willChange: true,
          });
        }
      }

      if (matched.importData.condition !== undefined) {
        const currentCondition = variant.condition || '';
        const newCondition = matched.importData.condition || '';
        if (currentCondition !== newCondition) {
          changes.push({
            field: 'condition',
            current: variant.condition,
            new: matched.importData.condition,
            willChange: true,
          });
        }
      }

      // Compare model fields
      if (matched.importData.packedPurchasePrice !== undefined) {
        const currentPrice = model.packedPurchasePrice ?? null;
        const newPrice = matched.importData.packedPurchasePrice ?? null;
        // Compare with precision (handle float comparison)
        const currentPriceNum = currentPrice !== null ? Number(currentPrice) : null;
        const newPriceNum = newPrice !== null ? Number(newPrice) : null;
        if (currentPriceNum !== newPriceNum && 
            (currentPriceNum === null || newPriceNum === null || 
             Math.abs(currentPriceNum - newPriceNum) > 0.01)) {
          changes.push({
            field: 'packedPurchasePrice',
            current: model.packedPurchasePrice,
            new: matched.importData.packedPurchasePrice,
            willChange: true,
          });
        }
      }

      if (matched.importData.packedMarketPrice !== undefined) {
        const currentPrice = model.packedMarketPrice ?? null;
        const newPrice = matched.importData.packedMarketPrice ?? null;
        // Compare with precision (handle float comparison)
        const currentPriceNum = currentPrice !== null ? Number(currentPrice) : null;
        const newPriceNum = newPrice !== null ? Number(newPrice) : null;
        if (currentPriceNum !== newPriceNum && 
            (currentPriceNum === null || newPriceNum === null || 
             Math.abs(currentPriceNum - newPriceNum) > 0.01)) {
          changes.push({
            field: 'packedMarketPrice',
            current: model.packedMarketPrice,
            new: matched.importData.packedMarketPrice,
            willChange: true,
          });
        }
      }

      if (matched.importData.packedOriginalPrice !== undefined) {
        const currentPrice = model.packedOriginalPrice ?? null;
        const newPrice = matched.importData.packedOriginalPrice ?? null;
        // Compare with precision (handle float comparison)
        const currentPriceNum = currentPrice !== null ? Number(currentPrice) : null;
        const newPriceNum = newPrice !== null ? Number(newPrice) : null;
        if (currentPriceNum !== newPriceNum && 
            (currentPriceNum === null || newPriceNum === null || 
             Math.abs(currentPriceNum - newPriceNum) > 0.01)) {
          changes.push({
            field: 'packedOriginalPrice',
            current: model.packedOriginalPrice,
            new: matched.importData.packedOriginalPrice,
            willChange: true,
          });
        }
      }

      if (matched.importData.loosePurchasePrice !== undefined) {
        const currentPrice = model.loosePurchasePrice ?? null;
        const newPrice = matched.importData.loosePurchasePrice ?? null;
        if (currentPrice !== newPrice) {
          changes.push({
            field: 'loosePurchasePrice',
            current: model.loosePurchasePrice,
            new: matched.importData.loosePurchasePrice,
            willChange: true,
          });
        }
      }

      if (matched.importData.looseMarketPrice !== undefined) {
        const currentPrice = model.looseMarketPrice ?? null;
        const newPrice = matched.importData.looseMarketPrice ?? null;
        if (currentPrice !== newPrice) {
          changes.push({
            field: 'looseMarketPrice',
            current: model.looseMarketPrice,
            new: matched.importData.looseMarketPrice,
            willChange: true,
          });
        }
      }

      if (matched.importData.modelNotes !== undefined) {
        const currentNotes = model.notes || '';
        const newNotes = matched.importData.modelNotes || '';
        if (currentNotes !== newNotes) {
          changes.push({
            field: 'modelNotes',
            current: model.notes,
            new: matched.importData.modelNotes,
            willChange: true,
          });
        }
      }

      preview.push({
        rowIndex: i + 1,
        importData: matched.importData,
        currentData: {
          variant: {
            id: variant.id,
            packedOwned: variant.packedOwned,
            looseOwned: variant.looseOwned,
            wishlisted: variant.wishlisted,
            quantity: variant.quantity,
            notes: variant.notes,
            condition: variant.condition,
          },
          model: {
            id: model.id,
            packedPurchasePrice: model.packedPurchasePrice,
            packedMarketPrice: model.packedMarketPrice,
            packedOriginalPrice: model.packedOriginalPrice,
            loosePurchasePrice: model.loosePurchasePrice,
            looseMarketPrice: model.looseMarketPrice,
            notes: model.notes,
          },
        },
        matchStatus: 'matched',
        matchMethod: matched.matchMethod,
        changes,
      });
    }

    // Process unmatched rows
    for (const error of matchResult.errors) {
      const rowIndex = error.rowIndex;
      const row = rows[rowIndex - 1];
      if (row) {
        preview.push({
          rowIndex,
          importData: row,
          currentData: null,
          matchStatus: 'unmatched',
          changes: [],
        });
      }
    }

    const response: PreviewResponse = {
      totalRows: rows.length,
      matched: matchResult.matched,
      unmatched: matchResult.unmatched,
      preview,
      errors: matchResult.errors,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

