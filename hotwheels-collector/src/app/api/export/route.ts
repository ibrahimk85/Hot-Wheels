import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json'; // json, csv, excel
    const type = searchParams.get('type') || 'all'; // all, models, variants

    // Fetch data based on type
    let data: any = {};

    if (type === 'all' || type === 'models') {
      data.models = await prisma.model.findMany({
        include: {
          collection: {
            include: {
              year: true,
            },
          },
          subSeries: true,
        },
      });
    }

    if (type === 'all' || type === 'variants') {
      data.variants = await prisma.variant.findMany({
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
    }

    if (type === 'all') {
      data.collections = await prisma.collection.findMany({
        include: {
          year: true,
        },
      });
      data.subSeries = await prisma.subSeries.findMany({
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      });
    }

    // Add metadata
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type,
      ...data,
    };

    // Generate file based on format
    if (format === 'json') {
      return NextResponse.json(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="hotwheels-export-${Date.now()}.json"`,
        },
      });
    }

    if (format === 'csv') {
      // Convert to CSV
      let csvContent = '';
      
      if (type === 'variants' || type === 'all') {
        csvContent += 'Variant ID,Model Name,Year,Color,Card Number,TH,STH,Owned,Quantity,Collection,SubSeries\n';
        for (const variant of data.variants || []) {
          csvContent += `${variant.id},"${variant.model.castingName}",${variant.year},"${variant.color || ''}","${variant.cardNumber || ''}",${variant.isTreasureHunt},${variant.isSuperTreasureHunt},${variant.owned},${variant.quantity},"${variant.model.collection.name}","${variant.model.subSeries?.name || ''}"\n`;
        }
      }

      if (type === 'models' || type === 'all') {
        if (csvContent) csvContent += '\n\n';
        csvContent += 'Model ID,Casting Name,Toy #,Collection,SubSeries,Owned,Wishlisted,Quantity,Packed Price,Loose Price\n';
        for (const model of data.models || []) {
          csvContent += `${model.id},"${model.castingName}","${model.castingId || ''}","${model.collection.name}","${model.subSeries?.name || ''}",${model.owned},${model.wishlisted},${model.quantity},${model.packedPrice || ''},${model.loosePrice || ''}\n`;
        }
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="hotwheels-export-${Date.now()}.csv"`,
        },
      });
    }

    if (format === 'excel') {
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      if (type === 'variants' || type === 'all') {
        const variantData = (data.variants || []).map((v: any) => ({
          'Variant ID': v.id,
          'Model Name': v.model.castingName,
          Year: v.year,
          Color: v.color || '',
          'Card Number': v.cardNumber || '',
          TH: v.isTreasureHunt,
          STH: v.isSuperTreasureHunt,
          Owned: v.owned,
          Quantity: v.quantity,
          Collection: v.model.collection.name,
          SubSeries: v.model.subSeries?.name || '',
        }));
        const variantSheet = XLSX.utils.json_to_sheet(variantData);
        XLSX.utils.book_append_sheet(workbook, variantSheet, 'Variants');
      }

      if (type === 'models' || type === 'all') {
        const modelData = (data.models || []).map((m: any) => ({
          'Model ID': m.id,
          'Casting Name': m.castingName,
          'Toy #': m.castingId || '',
          Collection: m.collection.name,
          SubSeries: m.subSeries?.name || '',
          Owned: m.owned,
          Wishlisted: m.wishlisted,
          Quantity: m.quantity,
          'Packed Price': m.packedPrice || '',
          'Loose Price': m.loosePrice || '',
        }));
        const modelSheet = XLSX.utils.json_to_sheet(modelData);
        XLSX.utils.book_append_sheet(workbook, modelSheet, 'Models');
      }

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="hotwheels-export-${Date.now()}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}




