import ExcelJS from 'exceljs';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import type { VariantExcelData } from './report.service';

const THUMBNAIL_SIZE = 100; // Thumbnail width and height in pixels

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
 * Export variants to Excel with thumbnail images
 */
export async function exportVariantsToExcel(
  data: Array<VariantExcelData & { id: number }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Variants');

  // Set column headers
  worksheet.columns = [
    { header: 'Toy#', key: 'toyNumber', width: 12 },
    { header: 'Col#', key: 'colNumber', width: 12 },
    { header: 'Model Ismi', key: 'modelName', width: 35 },
    { header: 'Series', key: 'series', width: 30 },
    { header: 'Series#', key: 'seriesNumber', width: 15 },
    { header: 'Photo Thumbnail', key: 'photoThumbnail', width: 18 },
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
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const row = worksheet.addRow({
      toyNumber: item.toyNumber || '',
      colNumber: item.colNumber || '',
      modelName: item.modelName,
      series: item.series || '',
      seriesNumber: item.seriesNumber || '',
      photoThumbnail: '', // Placeholder, image will be added separately
    });

    // Set row height
    row.height = ROW_HEIGHT;

    // Add image if available
    if (item.photoThumbnail) {
      try {
        const imageBuffer = await resizeImageToThumbnail(item.photoThumbnail);
        if (imageBuffer) {
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
          });

          // Add image to the photo thumbnail column (column F, index 5)
          worksheet.addImage(imageId, {
            tl: { col: 5, row: i + 1 },
            ext: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
          });
        }
      } catch (error) {
        console.error(`Error adding image for row ${i + 1}:`, error);
      }
    }

    // Align cells
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
