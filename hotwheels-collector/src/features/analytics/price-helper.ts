/**
 * Helper functions for price calculations
 * Uses market prices first, falls back to purchase prices, then to old price fields
 */

export interface ModelPriceFields {
  packedMarketPrice?: number | null;
  looseMarketPrice?: number | null;
  packedPurchasePrice?: number | null;
  loosePurchasePrice?: number | null;
  packedPrice?: number | null;
  loosePrice?: number | null;
}

/**
 * Get market price for a model (prefers market price, falls back to purchase price, then old price)
 */
export function getMarketPrice(model: ModelPriceFields, preferPacked: boolean = true): number {
  if (preferPacked) {
    const packed = model.packedMarketPrice ?? model.packedPurchasePrice ?? model.packedPrice ?? 0;
    const loose = model.looseMarketPrice ?? model.loosePurchasePrice ?? model.loosePrice ?? 0;
    return Math.max(packed, loose);
  } else {
    const loose = model.looseMarketPrice ?? model.loosePurchasePrice ?? model.loosePrice ?? 0;
    const packed = model.packedMarketPrice ?? model.packedPurchasePrice ?? model.packedPrice ?? 0;
    return Math.max(loose, packed);
  }
}

/**
 * Get purchase price for a model (prefers purchase price, falls back to old price)
 */
export function getPurchasePrice(model: ModelPriceFields, preferPacked: boolean = true): number {
  if (preferPacked) {
    const packed = model.packedPurchasePrice ?? model.packedPrice ?? 0;
    const loose = model.loosePurchasePrice ?? model.loosePrice ?? 0;
    return Math.max(packed, loose);
  } else {
    const loose = model.loosePurchasePrice ?? model.loosePrice ?? 0;
    const packed = model.packedPurchasePrice ?? model.packedPrice ?? 0;
    return Math.max(loose, packed);
  }
}

/**
 * Get packed market price (falls back to purchase, then old price)
 */
export function getPackedMarketPrice(model: ModelPriceFields): number {
  return model.packedMarketPrice ?? model.packedPurchasePrice ?? model.packedPrice ?? 0;
}

/**
 * Get loose market price (falls back to purchase, then old price)
 */
export function getLooseMarketPrice(model: ModelPriceFields): number {
  return model.looseMarketPrice ?? model.loosePurchasePrice ?? model.loosePrice ?? 0;
}

/**
 * Get packed purchase price (falls back to old price)
 */
export function getPackedPurchasePrice(model: ModelPriceFields): number {
  return model.packedPurchasePrice ?? model.packedPrice ?? 0;
}

/**
 * Get loose purchase price (falls back to old price)
 */
export function getLoosePurchasePrice(model: ModelPriceFields): number {
  return model.loosePurchasePrice ?? model.loosePrice ?? 0;
}



