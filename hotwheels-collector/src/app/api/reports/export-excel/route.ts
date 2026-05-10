import { NextRequest, NextResponse } from 'next/server';
import { getVariantsForExcelExport } from '@/features/reports/report.service';
import { exportVariantsToExcel } from '@/features/reports/excel-export.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owned, year, collectionId } = body;

    // Validate owned parameter
    if (owned !== undefined && owned !== 'all' && typeof owned !== 'boolean') {
      return NextResponse.json(
        { error: 'owned must be true, false, or "all"' },
        { status: 400 }
      );
    }

    // Fix: owned can be false, which is falsy, so we need explicit check
    const ownedFilter = owned === undefined ? 'all' : owned;

    // Get variants data
    const variants = await getVariantsForExcelExport({
      owned: ownedFilter,
      year: year ? Number(year) : undefined,
      collectionId: collectionId ? Number(collectionId) : undefined,
    });

    // Export to Excel
    const buffer = await exportVariantsToExcel(variants);

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="hotwheels-export-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to export to Excel';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

