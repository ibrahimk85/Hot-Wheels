import prisma from '@/db';
import { VariantFilters } from '@/features/variants/variant.service';
import { getVariants } from '@/features/variants/variant.service';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const THUMBNAIL_SIZE = 100; // Thumbnail width and height in pixels

export interface ExportRow {
  // Variant fields
  variantId: number;
  year: number;
  cardNumber: string | null;
  toyNumber: string | null;
  color: string | null;
  releaseName: string | null;
  packedOwned: boolean;
  looseOwned: boolean;
  wishlisted: boolean;
  quantity: number;
  variantNotes: string | null;
  condition: string | null;
  // Model fields
  modelId: number;
  castingName: string;
  castingId: string | null;
  collectionName: string;
  subSeriesName: string | null;
  packedPurchasePrice: number | null;
  packedMarketPrice: number | null;
  packedOriginalPrice: number | null;
  loosePurchasePrice: number | null;
  looseMarketPrice: number | null;
  modelNotes: string | null;
  // Image path for thumbnail
  thumbnailPath: string | null;
}

/**
 * Export filtered variants to CSV/Excel format
 */
export async function exportVariants(
  filters: VariantFilters,
  format: 'csv' | 'excel' = 'excel'
): Promise<Buffer> {
  // Get all variants matching the filters (no pagination for export)
  // Use a very large limit to get all records
  const variants = await getVariants({
    ...filters,
    limit: 1000000, // Very large number to get all records
    offset: 0,
  });

  console.log(`Export: Found ${variants.length} variants with filters:`, filters);

  // Transform variants to export rows with image paths
  const rows: ExportRow[] = variants.map((variant) => {
    // Get first image from variant, or fallback to model image
    const image = variant.images[0] || variant.model.images[0];
    // Image path handling: paths are stored relative to public folder
    let imagePath: string | null = null;
    if (image) {
      const imgPath = image.path;
      if (imgPath.startsWith('/images/')) {
        imagePath = imgPath;
      } else if (imgPath.startsWith('/')) {
        imagePath = imgPath;
      } else if (imgPath.startsWith('images/')) {
        imagePath = `/${imgPath}`;
      } else {
        imagePath = `/images/hotwheels/${imgPath}`;
      }
    }

    return {
      variantId: variant.id,
      year: variant.year,
      cardNumber: variant.cardNumber,
      toyNumber: variant.toyNumber,
      color: variant.color,
      releaseName: variant.releaseName,
      packedOwned: variant.packedOwned,
      looseOwned: variant.looseOwned,
      wishlisted: variant.wishlisted,
      quantity: variant.quantity,
      variantNotes: variant.notes,
      condition: variant.condition,
      modelId: variant.model.id,
      castingName: variant.model.castingName,
      castingId: variant.model.castingId,
      collectionName: variant.model.subSeries?.collection?.name || '',
      subSeriesName: variant.model.subSeries?.name || null,
      packedPurchasePrice: variant.model.packedPurchasePrice,
      packedMarketPrice: variant.model.packedMarketPrice,
      packedOriginalPrice: variant.model.packedOriginalPrice,
      loosePurchasePrice: variant.model.loosePurchasePrice,
      looseMarketPrice: variant.model.looseMarketPrice,
      modelNotes: variant.model.notes,
      thumbnailPath: imagePath,
    };
  });

  if (format === 'csv') {
    return Buffer.from(convertToCSV(rows));
  } else {
    return await convertToExcel(rows);
  }
}

/**
 * Convert rows to CSV format
 */
function convertToCSV(rows: ExportRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  // CSV headers
  const headers = [
    'Variant ID',
    'Year',
    'Card Number',
    'Toy Number',
    'Color',
    'Release Name',
    'Packed Owned',
    'Loose Owned',
    'Wishlisted',
    'Quantity',
    'Variant Notes',
    'Condition',
    'Model ID',
    'Casting Name',
    'Casting ID',
    'Collection Name',
    'Sub Series Name',
    'Packed Purchase Price (€)',
    'Packed Market Price (€)',
    'Packed Original Price (€)',
    'Loose Purchase Price (€)',
    'Loose Market Price (€)',
    'Model Notes',
    'Thumbnail Path',
  ];

  // Convert rows to CSV format
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.variantId,
        row.year,
        escapeCSVValue(row.cardNumber),
        escapeCSVValue(row.toyNumber),
        escapeCSVValue(row.color),
        escapeCSVValue(row.releaseName),
        row.packedOwned ? 'true' : 'false',
        row.looseOwned ? 'true' : 'false',
        row.wishlisted ? 'true' : 'false',
        row.quantity,
        escapeCSVValue(row.variantNotes),
        escapeCSVValue(row.condition),
        row.modelId,
        escapeCSVValue(row.castingName),
        escapeCSVValue(row.castingId),
        escapeCSVValue(row.collectionName),
        escapeCSVValue(row.subSeriesName),
        row.packedPurchasePrice ?? '',
        row.packedMarketPrice ?? '',
        row.packedOriginalPrice ?? '',
        row.loosePurchasePrice ?? '',
        row.looseMarketPrice ?? '',
        escapeCSVValue(row.modelNotes),
        escapeCSVValue(row.thumbnailPath),
      ].join(',')
    ),
  ];

  return csvRows.join('\n');
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCSVValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Resize image to thumbnail
 */
async function resizeImageToThumbnail(
  imagePath: string
): Promise<Buffer | null> {
  try {
    const fullPath = path.join(process.cwd(), 'public', imagePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.warn(`Image not found: ${fullPath}`);
      return null;
    }

    // Read and resize image
    const resized = await sharp(fullPath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    return resized;
  } catch (error) {
    console.error(`Error resizing image ${imagePath}:`, error);
    return null;
  }
}

/**
 * Convert rows to Excel format with thumbnails
 */
async function convertToExcel(rows: ExportRow[]): Promise<Buffer> {
  // Create workbook using ExcelJS for image support
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Variants');

  // Set column headers
  worksheet.columns = [
    { header: 'Variant ID', key: 'variantId', width: 10 },
    { header: 'Year', key: 'year', width: 6 },
    { header: 'Card Number', key: 'cardNumber', width: 12 },
    { header: 'Toy Number', key: 'toyNumber', width: 12 },
    { header: 'Color', key: 'color', width: 15 },
    { header: 'Release Name', key: 'releaseName', width: 20 },
    { header: 'Packed Owned', key: 'packedOwned', width: 12 },
    { header: 'Loose Owned', key: 'looseOwned', width: 12 },
    { header: 'Wishlisted', key: 'wishlisted', width: 10 },
    { header: 'Quantity', key: 'quantity', width: 8 },
    { header: 'Variant Notes', key: 'variantNotes', width: 30 },
    { header: 'Condition', key: 'condition', width: 12 },
    { header: 'Model ID', key: 'modelId', width: 8 },
    { header: 'Casting Name', key: 'castingName', width: 25 },
    { header: 'Casting ID', key: 'castingId', width: 12 },
    { header: 'Collection Name', key: 'collectionName', width: 20 },
    { header: 'Sub Series Name', key: 'subSeriesName', width: 20 },
    { header: 'Packed Purchase Price (€)', key: 'packedPurchasePrice', width: 18 },
    { header: 'Packed Market Price (€)', key: 'packedMarketPrice', width: 18 },
    { header: 'Packed Original Price (€)', key: 'packedOriginalPrice', width: 18 },
    { header: 'Loose Purchase Price (€)', key: 'loosePurchasePrice', width: 18 },
    { header: 'Loose Market Price (€)', key: 'looseMarketPrice', width: 18 },
    { header: 'Model Notes', key: 'modelNotes', width: 30 },
    { header: 'Thumbnail', key: 'thumbnail', width: 18 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Set row height for image rows
  const ROW_HEIGHT = 80;

  // Add data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const excelRow = worksheet.addRow({
      variantId: row.variantId,
      year: row.year,
      cardNumber: row.cardNumber ?? '',
      toyNumber: row.toyNumber ?? '',
      color: row.color ?? '',
      releaseName: row.releaseName ?? '',
      packedOwned: row.packedOwned,
      looseOwned: row.looseOwned,
      wishlisted: row.wishlisted,
      quantity: row.quantity,
      variantNotes: row.variantNotes ?? '',
      condition: row.condition ?? '',
      modelId: row.modelId,
      castingName: row.castingName,
      castingId: row.castingId ?? '',
      collectionName: row.collectionName,
      subSeriesName: row.subSeriesName ?? '',
      packedPurchasePrice: row.packedPurchasePrice ?? '',
      packedMarketPrice: row.packedMarketPrice ?? '',
      packedOriginalPrice: row.packedOriginalPrice ?? '',
      loosePurchasePrice: row.loosePurchasePrice ?? '',
      looseMarketPrice: row.looseMarketPrice ?? '',
      modelNotes: row.modelNotes ?? '',
      thumbnail: '', // Placeholder, image will be added separately
    });

    // Set row height
    excelRow.height = ROW_HEIGHT;

    // Add image if available
    if (row.thumbnailPath) {
      try {
        const imageBuffer = await resizeImageToThumbnail(row.thumbnailPath);
        if (imageBuffer) {
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
          });

          // Add image to the thumbnail column (last column, index 23)
          worksheet.addImage(imageId, {
            tl: { col: 23, row: i + 1 },
            ext: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
          });
        }
      } catch (error) {
        console.error(`Error adding image for row ${i + 1}:`, error);
      }
    }

    // Align cells
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(12).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(14).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(15).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(16).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(17).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(18).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(19).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(20).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(21).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(22).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(23).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(24).alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

