import * as XLSX from 'xlsx';

export interface CSVImportMapping {
  castingName: string;
  castingId?: string;
  collectionName: string;
  year: number;
  subSeriesName?: string;
  owned?: boolean;
  wishlisted?: boolean;
  quantity?: number;
  packedPrice?: number;
  loosePrice?: number;
  notes?: string;
  // Variant fields
  cardNumber?: string;
  color?: string;
  isTreasureHunt?: boolean;
  isSuperTreasureHunt?: boolean;
}

export interface CSVImportOptions {
  hasHeader: boolean;
  columnMapping: Record<string, string>; // CSV column -> field mapping
  skipRows?: number;
}

/**
 * CSV dosyasını parse et
 */
export function parseCSV(
  csvContent: string,
  options: CSVImportOptions
): CSVImportMapping[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  const startIndex = options.hasHeader ? 1 : 0;
  const skipRows = options.skipRows || 0;

  const results: CSVImportMapping[] = [];

  for (let i = startIndex + skipRows; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV parsing (basit, virgülle ayrılmış)
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

    const mapping: CSVImportMapping = {
      castingName: '',
      collectionName: '',
      year: new Date().getFullYear(),
    };

    // Column mapping'e göre değerleri ata
    for (const [csvColumn, field] of Object.entries(options.columnMapping)) {
      const columnIndex = parseInt(csvColumn);
      if (!isNaN(columnIndex) && values[columnIndex]) {
        const value = values[columnIndex];

        switch (field) {
          case 'castingName':
            mapping.castingName = value;
            break;
          case 'castingId':
            mapping.castingId = value;
            break;
          case 'collectionName':
            mapping.collectionName = value;
            break;
          case 'year':
            mapping.year = parseInt(value) || new Date().getFullYear();
            break;
          case 'subSeriesName':
            mapping.subSeriesName = value;
            break;
          case 'owned':
            mapping.owned = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'wishlisted':
            mapping.wishlisted = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'quantity':
            mapping.quantity = parseInt(value) || 0;
            break;
          case 'packedPrice':
            mapping.packedPrice = parseFloat(value) || undefined;
            break;
          case 'loosePrice':
            mapping.loosePrice = parseFloat(value) || undefined;
            break;
          case 'notes':
            mapping.notes = value;
            break;
          case 'cardNumber':
            mapping.cardNumber = value;
            break;
          case 'color':
            mapping.color = value;
            break;
          case 'isTreasureHunt':
            mapping.isTreasureHunt = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'isSuperTreasureHunt':
            mapping.isSuperTreasureHunt = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
        }
      }
    }

    // Minimum required fields kontrolü
    if (mapping.castingName && mapping.collectionName) {
      results.push(mapping);
    }
  }

  return results;
}

/**
 * Excel dosyasını parse et
 */
export function parseExcel(
  buffer: ArrayBuffer,
  options: CSVImportOptions
): CSVImportMapping[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  const results: CSVImportMapping[] = [];
  const startIndex = options.hasHeader ? 1 : 0;
  const skipRows = options.skipRows || 0;

  for (let i = startIndex + skipRows; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const mapping: CSVImportMapping = {
      castingName: '',
      collectionName: '',
      year: new Date().getFullYear(),
    };

    // Column mapping'e göre değerleri ata
    for (const [csvColumn, field] of Object.entries(options.columnMapping)) {
      const columnIndex = parseInt(csvColumn);
      if (!isNaN(columnIndex) && row[columnIndex] !== undefined) {
        const value = String(row[columnIndex] || '').trim();

        switch (field) {
          case 'castingName':
            mapping.castingName = value;
            break;
          case 'castingId':
            mapping.castingId = value;
            break;
          case 'collectionName':
            mapping.collectionName = value;
            break;
          case 'year':
            mapping.year = parseInt(value) || new Date().getFullYear();
            break;
          case 'subSeriesName':
            mapping.subSeriesName = value;
            break;
          case 'owned':
            mapping.owned = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'wishlisted':
            mapping.wishlisted = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'quantity':
            mapping.quantity = parseInt(value) || 0;
            break;
          case 'packedPrice':
            mapping.packedPrice = parseFloat(value) || undefined;
            break;
          case 'loosePrice':
            mapping.loosePrice = parseFloat(value) || undefined;
            break;
          case 'notes':
            mapping.notes = value;
            break;
          case 'cardNumber':
            mapping.cardNumber = value;
            break;
          case 'color':
            mapping.color = value;
            break;
          case 'isTreasureHunt':
            mapping.isTreasureHunt = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
          case 'isSuperTreasureHunt':
            mapping.isSuperTreasureHunt = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
            break;
        }
      }
    }

    // Minimum required fields kontrolü
    if (mapping.castingName && mapping.collectionName) {
      results.push(mapping);
    }
  }

  return results;
}



