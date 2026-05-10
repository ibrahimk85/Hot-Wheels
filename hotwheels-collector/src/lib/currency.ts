/**
 * Currency utility functions
 * All prices are in EUR (Euro)
 */

export const CURRENCY = 'EUR';
export const CURRENCY_SYMBOL = '€';

/**
 * Format a price value with EUR currency
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) {
    return '-';
  }
  
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format a price value with EUR currency symbol (simple format)
 */
export function formatPriceSimple(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) {
    return '-';
  }
  
  return `${price.toFixed(2)} ${CURRENCY_SYMBOL}`;
}

/**
 * Get currency label for display
 */
export function getCurrencyLabel(): string {
  return CURRENCY;
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(): string {
  return CURRENCY_SYMBOL;
}







