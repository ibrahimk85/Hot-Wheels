import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import * as XLSX from 'xlsx';
import { parseCSV, parseExcel, type CSVImportMapping } from '@/features/data-management/csv-import.service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = formData.get('format') as string || 'json';
    const mode = formData.get('mode') as string || 'merge'; // merge, replace

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    let data: any = {};

    // Parse file based on format
    let csvMappings: CSVImportMapping[] | null = null;
    
    if (format === 'json') {
      const text = new TextDecoder().decode(buffer);
      data = JSON.parse(text);
    } else if (format === 'csv') {
      const text = new TextDecoder().decode(buffer);
      // Default column mapping (kullanıcı tarafından özelleştirilebilir)
      const columnMapping = JSON.parse(formData.get('columnMapping') as string || '{}');
      const hasHeader = formData.get('hasHeader') === 'true';
      
      csvMappings = parseCSV(text, {
        hasHeader,
        columnMapping: columnMapping || {
          '0': 'castingName',
          '1': 'collectionName',
          '2': 'year',
          '3': 'owned',
        },
      });
    } else if (format === 'excel') {
      // Default column mapping
      const columnMapping = JSON.parse(formData.get('columnMapping') as string || '{}');
      const hasHeader = formData.get('hasHeader') === 'true';
      
      csvMappings = parseExcel(buffer, {
        hasHeader,
        columnMapping: columnMapping || {
          '0': 'castingName',
          '1': 'collectionName',
          '2': 'year',
          '3': 'owned',
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const results = {
      imported: 0,
      updated: 0,
      errors: [] as string[],
    };

    // CSV/Excel import
    if (csvMappings && csvMappings.length > 0) {
      for (const mapping of csvMappings) {
        try {
          // Find or create year
          let year = await prisma.year.findFirst({
            where: { year: mapping.year },
          });

          if (!year) {
            year = await prisma.year.create({
              data: { year: mapping.year },
            });
          }

          // Find or create collection
          let collection = await prisma.collection.findFirst({
            where: {
              name: mapping.collectionName,
              yearId: year.id,
            },
          });

          if (!collection) {
            collection = await prisma.collection.create({
              data: {
                name: mapping.collectionName,
                code: mapping.collectionName,
                yearId: year.id,
              },
            });
          }

          // Find or create subSeries if provided
          let subSeries = null;
          if (mapping.subSeriesName) {
            subSeries = await prisma.subSeries.findFirst({
              where: {
                name: mapping.subSeriesName,
                collectionId: collection.id,
              },
            });

            if (!subSeries) {
              subSeries = await prisma.subSeries.create({
                data: {
                  name: mapping.subSeriesName,
                  collectionId: collection.id,
                },
              });
            }
          }

          // Find or create model
          let model = await prisma.model.findFirst({
            where: {
              castingName: mapping.castingName,
              collectionId: collection.id,
            },
          });

          if (model) {
            // Update existing model
            await prisma.model.update({
              where: { id: model.id },
              data: {
                castingId: mapping.castingId || model.castingId,
                owned: mapping.owned !== undefined ? mapping.owned : model.owned,
                wishlisted: mapping.wishlisted !== undefined ? mapping.wishlisted : model.wishlisted,
                quantity: mapping.quantity !== undefined ? mapping.quantity : model.quantity,
                packedPrice: mapping.packedPrice || model.packedPrice,
                loosePrice: mapping.loosePrice || model.loosePrice,
                notes: mapping.notes || model.notes,
                subSeriesId: subSeries?.id || model.subSeriesId,
              },
            });
            results.updated++;
          } else {
            // Create new model
            model = await prisma.model.create({
              data: {
                castingName: mapping.castingName,
                castingId: mapping.castingId,
                owned: mapping.owned || false,
                wishlisted: mapping.wishlisted || false,
                quantity: mapping.quantity || 0,
                packedPrice: mapping.packedPrice,
                loosePrice: mapping.loosePrice,
                notes: mapping.notes,
                collectionId: collection.id,
                subSeriesId: subSeries?.id,
              },
            });
            results.imported++;
          }

          // Create variant if cardNumber or color provided
          if (mapping.cardNumber || mapping.color) {
            const existingVariant = await prisma.variant.findFirst({
              where: {
                modelId: model.id,
                cardNumber: mapping.cardNumber || null,
                color: mapping.color || null,
              },
            });

            if (!existingVariant) {
              await prisma.variant.create({
                data: {
                  modelId: model.id,
                  year: mapping.year,
                  cardNumber: mapping.cardNumber,
                  color: mapping.color,
                  isTreasureHunt: mapping.isTreasureHunt || false,
                  isSuperTreasureHunt: mapping.isSuperTreasureHunt || false,
                  owned: mapping.owned || false,
                  quantity: mapping.quantity || 0,
                },
              });
            }
          }
        } catch (error: any) {
          results.errors.push(`Error importing ${mapping.castingName}: ${error.message}`);
        }
      }

      return NextResponse.json({
        success: true,
        results,
        message: `Import completed: ${results.imported} imported, ${results.updated} updated, ${results.errors.length} errors`,
      });
    }

    // JSON import (existing logic)
    // Validate data structure
    if (!data.version || !data.exportDate) {
      return NextResponse.json({ error: 'Invalid export file format' }, { status: 400 });
    }

    // Import models if present
    if (data.models && Array.isArray(data.models)) {
      for (const modelData of data.models) {
        try {
          // Find or create collection
          let collection = await prisma.collection.findFirst({
            where: {
              name: modelData.collection?.name || modelData.collectionName,
              year: {
                year: modelData.collection?.year?.year || modelData.year,
              },
            },
          });

          if (!collection && modelData.collection) {
            // Find or create year
            let year = await prisma.year.findFirst({
              where: { year: modelData.collection.year.year },
            });

            if (!year) {
              year = await prisma.year.create({
                data: { year: modelData.collection.year.year },
              });
            }

            collection = await prisma.collection.create({
              data: {
                name: modelData.collection.name,
                code: modelData.collection.code,
                yearId: year.id,
              },
            });
          }

          if (!collection) {
            results.errors.push(`Collection not found for model: ${modelData.castingName}`);
            continue;
          }

          // Find or create subSeries if provided
          let subSeries = null;
          if (modelData.subSeries?.name) {
            subSeries = await prisma.subSeries.findFirst({
              where: {
                name: modelData.subSeries.name,
                collectionId: collection.id,
              },
            });

            if (!subSeries) {
              subSeries = await prisma.subSeries.create({
                data: {
                  name: modelData.subSeries.name,
                  collectionId: collection.id,
                },
              });
            }
          }

          // Find existing model
          const existingModel = await prisma.model.findFirst({
            where: {
              castingName: modelData.castingName,
              collectionId: collection.id,
            },
          });

          if (existingModel) {
            // Update existing model
            await prisma.model.update({
              where: { id: existingModel.id },
              data: {
                castingId: modelData.castingId || existingModel.castingId,
                description: modelData.description || existingModel.description,
                owned: modelData.owned !== undefined ? modelData.owned : existingModel.owned,
                wishlisted: modelData.wishlisted !== undefined ? modelData.wishlisted : existingModel.wishlisted,
                quantity: modelData.quantity !== undefined ? modelData.quantity : existingModel.quantity,
                packedPrice: modelData.packedPrice || existingModel.packedPrice,
                loosePrice: modelData.loosePrice || existingModel.loosePrice,
                notes: modelData.notes || existingModel.notes,
                subSeriesId: subSeries?.id || existingModel.subSeriesId,
              },
            });
            results.updated++;
          } else {
            // Create new model
            await prisma.model.create({
              data: {
                castingName: modelData.castingName,
                castingId: modelData.castingId,
                description: modelData.description,
                owned: modelData.owned || false,
                wishlisted: modelData.wishlisted || false,
                quantity: modelData.quantity || 0,
                packedPrice: modelData.packedPrice,
                loosePrice: modelData.loosePrice,
                notes: modelData.notes,
                collectionId: collection.id,
                subSeriesId: subSeries?.id,
              },
            });
            results.imported++;
          }
        } catch (error: any) {
          results.errors.push(`Error importing model ${modelData.castingName}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Import completed: ${results.imported} imported, ${results.updated} updated, ${results.errors.length} errors`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


