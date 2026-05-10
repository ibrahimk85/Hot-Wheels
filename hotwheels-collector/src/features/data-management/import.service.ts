import prisma from '@/db';
import * as XLSX from 'xlsx';

export interface ImportRow {
  variantId?: number;
  year?: number;
  cardNumber?: string;
  toyNumber?: string;
  castingName?: string;
  // User-editable fields (variant level)
  packedOwned?: boolean;
  looseOwned?: boolean;
  wishlisted?: boolean;
  quantity?: number;
  variantNotes?: string;
  condition?: string;
  // User-editable fields (model level)
  packedPurchasePrice?: number;
  packedMarketPrice?: number;
  packedOriginalPrice?: number;
  loosePurchasePrice?: number;
  looseMarketPrice?: number;
  modelNotes?: string;
}

export interface MatchedVariant {
  variantId: number;
  modelId: number;
  importData: ImportRow;
  matchMethod: 'variantId' | 'toyNumber' | 'cardNumber';
}

export interface ImportResult {
  totalRows: number;
  matched: number;
  unmatched: number;
  errors: Array<{ rowIndex: number; error: string }>;
  matchedVariants: MatchedVariant[];
}

/**
 * Parse CSV file
 */
export function parseCSVFile(csvContent: string): ImportRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => {
    // Clean header: remove quotes, (€), (), and other special characters, then lowercase
    return h.trim()
      .replace(/^"|"$/g, '') // Remove quotes
      .replace(/\([^)]*\)/g, '') // Remove anything in parentheses like (€)
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toLowerCase();
  });
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    headerMap.set(header, index);
  });

  // Parse rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: ImportRow = {};

    // Map CSV columns to ImportRow fields
    for (const [header, index] of headerMap.entries()) {
      const value = values[index]?.trim();
      if (value === undefined || value === '') continue;

      switch (header) {
        case 'variant id':
        case 'variantid':
          row.variantId = parseInt(value);
          break;
        case 'year':
          row.year = parseInt(value);
          break;
        case 'card number':
        case 'cardnumber':
          row.cardNumber = value;
          break;
        case 'toy number':
        case 'toynumber':
          row.toyNumber = value;
          break;
        case 'casting name':
        case 'castingname':
          row.castingName = value;
          break;
        case 'packed owned':
        case 'packedowned':
          row.packedOwned = parseBoolean(value);
          break;
        case 'loose owned':
        case 'looseowned':
          row.looseOwned = parseBoolean(value);
          break;
        case 'wishlisted':
          row.wishlisted = parseBoolean(value);
          break;
        case 'quantity':
          row.quantity = parseInt(value) || 0;
          break;
        case 'variant notes':
        case 'variantnotes':
          row.variantNotes = value;
          break;
        case 'condition':
          row.condition = value;
          break;
        case 'packed purchase price':
        case 'packedpurchaseprice':
        case 'packed purchase price €': // Handle with € symbol
          const packedPurchaseValue = parseFloat(value);
          row.packedPurchasePrice = isNaN(packedPurchaseValue) ? undefined : packedPurchaseValue;
          break;
        case 'packed market price':
        case 'packedmarketprice':
        case 'packed market price €': // Handle with € symbol
          const packedMarketValue = parseFloat(value);
          row.packedMarketPrice = isNaN(packedMarketValue) ? undefined : packedMarketValue;
          break;
        case 'packed original price':
        case 'packedoriginalprice':
        case 'packed original price €': // Handle with € symbol
          const packedOriginalValue = parseFloat(value);
          row.packedOriginalPrice = isNaN(packedOriginalValue) ? undefined : packedOriginalValue;
          break;
        case 'loose purchase price':
        case 'loosepurchaseprice':
        case 'loose purchase price €': // Handle with € symbol
          const loosePurchaseValue = parseFloat(value);
          row.loosePurchasePrice = isNaN(loosePurchaseValue) ? undefined : loosePurchaseValue;
          break;
        case 'loose market price':
        case 'loosemarketprice':
        case 'loose market price €': // Handle with € symbol
          const looseMarketValue = parseFloat(value);
          row.looseMarketPrice = isNaN(looseMarketValue) ? undefined : looseMarketValue;
          break;
        case 'model notes':
        case 'modelnotes':
          row.modelNotes = value;
          break;
      }
    }

    // Only add row if it has at least one identifier
    if (row.variantId || (row.toyNumber && row.year && row.castingName) || (row.cardNumber && row.year && row.castingName)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse CSV line (handle quoted values with commas)
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

/**
 * Parse Excel file
 */
export function parseExcelFile(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  if (data.length === 0) {
    return [];
  }

  // Parse header (first row)
  const headers = (data[0] || []).map((h) => {
    // Clean header: remove (€), (), and other special characters, then lowercase
    let cleaned = String(h || '')
      .trim()
      .replace(/\([^)]*\)/g, '') // Remove anything in parentheses like (€)
      .replace(/[^\w\s]/g, '') // Remove special characters except word chars and spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toLowerCase();
    return cleaned;
  });
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header) {
      headerMap.set(header, index);
      // Also add without spaces for flexibility
      const noSpaces = header.replace(/\s+/g, '');
      if (noSpaces && noSpaces !== header) {
        headerMap.set(noSpaces, index);
      }
    }
  });
  
  // Debug: Log header mapping
  console.log('Excel header mapping:', Array.from(headerMap.entries()));

  // Parse rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    if (!rowData || rowData.length === 0) continue;

    const row: ImportRow = {};

    // Map Excel columns to ImportRow fields
    for (const [header, index] of headerMap.entries()) {
      const value = rowData[index];
      if (value === undefined || value === null || value === '') continue;

      const stringValue = String(value).trim();
      if (!stringValue) continue;

      switch (header) {
        case 'variant id':
        case 'variantid':
          row.variantId = parseInt(stringValue);
          break;
        case 'year':
          row.year = parseInt(stringValue);
          break;
        case 'card number':
        case 'cardnumber':
          row.cardNumber = stringValue;
          break;
        case 'toy number':
        case 'toynumber':
          row.toyNumber = stringValue;
          break;
        case 'casting name':
        case 'castingname':
          row.castingName = stringValue;
          break;
        case 'packed owned':
        case 'packedowned':
          row.packedOwned = parseBoolean(stringValue);
          break;
        case 'loose owned':
        case 'looseowned':
          row.looseOwned = parseBoolean(stringValue);
          break;
        case 'wishlisted':
          row.wishlisted = parseBoolean(stringValue);
          break;
        case 'quantity':
          row.quantity = parseInt(stringValue) || 0;
          break;
        case 'variant notes':
        case 'variantnotes':
          row.variantNotes = stringValue;
          break;
        case 'condition':
          row.condition = stringValue;
          break;
        case 'packed purchase price':
        case 'packedpurchaseprice':
        case 'packed purchase price €': // Handle with € symbol
          const packedPurchaseValue = parseFloat(stringValue);
          row.packedPurchasePrice = isNaN(packedPurchaseValue) ? undefined : packedPurchaseValue;
          break;
        case 'packed market price':
        case 'packedmarketprice':
        case 'packed market price €': // Handle with € symbol
          const packedMarketValue = parseFloat(stringValue);
          row.packedMarketPrice = isNaN(packedMarketValue) ? undefined : packedMarketValue;
          break;
        case 'packed original price':
        case 'packedoriginalprice':
        case 'packed original price €': // Handle with € symbol
          const packedOriginalValue = parseFloat(stringValue);
          row.packedOriginalPrice = isNaN(packedOriginalValue) ? undefined : packedOriginalValue;
          break;
        case 'loose purchase price':
        case 'loosepurchaseprice':
        case 'loose purchase price €': // Handle with € symbol
          const loosePurchaseValue = parseFloat(stringValue);
          row.loosePurchasePrice = isNaN(loosePurchaseValue) ? undefined : loosePurchaseValue;
          break;
        case 'loose market price':
        case 'loosemarketprice':
        case 'loose market price €': // Handle with € symbol
          const looseMarketValue = parseFloat(stringValue);
          row.looseMarketPrice = isNaN(looseMarketValue) ? undefined : looseMarketValue;
          break;
        case 'model notes':
        case 'modelnotes':
          row.modelNotes = stringValue;
          break;
      }
    }

    // Only add row if it has at least one identifier
    if (row.variantId || (row.toyNumber && row.year && row.castingName) || (row.cardNumber && row.year && row.castingName)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse boolean value (handles true/false, 1/0, yes/no)
 */
function parseBoolean(value: string | boolean | number): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const lower = String(value).toLowerCase().trim();
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y';
}

/**
 * Match import rows to variants in database
 */
export async function matchImportRows(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    matched: 0,
    unmatched: 0,
    errors: [],
    matchedVariants: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let variant = null;
      let matchMethod: 'variantId' | 'toyNumber' | 'cardNumber' = 'variantId';

      // Strategy 1: Match by variantId (most reliable)
      if (row.variantId) {
        variant = await prisma.variant.findUnique({
          where: { id: row.variantId },
          include: { model: true },
        });
        if (variant) {
          matchMethod = 'variantId';
        }
      }

      // Strategy 2: Match by toyNumber + year + castingName
      if (!variant && row.toyNumber && row.year && row.castingName) {
        const model = await prisma.model.findFirst({
          where: {
            castingName: row.castingName,
            variants: {
              some: {
                toyNumber: row.toyNumber,
                year: row.year,
              },
            },
          },
          include: {
            variants: {
              where: {
                toyNumber: row.toyNumber,
                year: row.year,
              },
            },
          },
        });

        if (model && model.variants.length > 0) {
          variant = model.variants[0];
          matchMethod = 'toyNumber';
        }
      }

      // Strategy 3: Match by cardNumber + year + castingName
      if (!variant && row.cardNumber && row.year && row.castingName) {
        const model = await prisma.model.findFirst({
          where: {
            castingName: row.castingName,
            variants: {
              some: {
                cardNumber: row.cardNumber,
                year: row.year,
              },
            },
          },
          include: {
            variants: {
              where: {
                cardNumber: row.cardNumber,
                year: row.year,
              },
            },
          },
        });

        if (model && model.variants.length > 0) {
          variant = model.variants[0];
          matchMethod = 'cardNumber';
        }
      }

      if (variant) {
        result.matched++;
        result.matchedVariants.push({
          variantId: variant.id,
          modelId: variant.modelId,
          importData: row,
          matchMethod,
        });
      } else {
        result.unmatched++;
        result.errors.push({
          rowIndex: i + 1,
          error: 'Variant not found in database',
        });
      }
    } catch (error) {
      result.unmatched++;
      result.errors.push({
        rowIndex: i + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Get current database values for matched variants
 */
export async function getCurrentValues(matchedVariants: MatchedVariant[]) {
  const variantIds = matchedVariants.map((mv) => mv.variantId);
  const modelIds = [...new Set(matchedVariants.map((mv) => mv.modelId))];

  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: {
      model: {
        select: {
          id: true,
          packedPurchasePrice: true,
          packedMarketPrice: true,
          packedOriginalPrice: true,
          loosePurchasePrice: true,
          looseMarketPrice: true,
          notes: true,
        },
      },
    },
  });

  const models = await prisma.model.findMany({
    where: { id: { in: modelIds } },
    select: {
      id: true,
      packedPurchasePrice: true,
      packedMarketPrice: true,
      packedOriginalPrice: true,
      loosePurchasePrice: true,
      looseMarketPrice: true,
      notes: true,
    },
  });

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const modelMap = new Map(models.map((m) => [m.id, m]));

  return {
    variants: variantMap,
    models: modelMap,
  };
}

