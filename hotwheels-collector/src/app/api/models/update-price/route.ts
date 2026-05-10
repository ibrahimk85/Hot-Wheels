import { NextResponse } from 'next/server';
import prisma from '@/db';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const idRaw = formData.get('id');
    
    if (!idRaw) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }

    const id = Number(idRaw);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    // Check if model exists
    const existingModel = await prisma.model.findUnique({
      where: { id },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Get price values from formData (these may be empty strings)
    const packedPriceRaw = formData.get('packedPrice') as string | null;
    const loosePriceRaw = formData.get('loosePrice') as string | null;
    const packedPurchasePriceRaw = formData.get('packedPurchasePrice') as string | null;
    const packedMarketPriceRaw = formData.get('packedMarketPrice') as string | null;
    const packedOriginalPriceRaw = formData.get('packedOriginalPrice') as string | null;
    const loosePurchasePriceRaw = formData.get('loosePurchasePrice') as string | null;
    const looseMarketPriceRaw = formData.get('looseMarketPrice') as string | null;

    // Parse prices - handle empty strings and convert to null
    const parsePrice = (value: string | null | undefined): number | null => {
      if (!value || typeof value !== 'string' || value.trim() === '') return null;
      const parsed = parseFloat(value.trim());
      return isNaN(parsed) ? null : parsed;
    };

    const packedPrice = parsePrice(packedPriceRaw);
    const loosePrice = parsePrice(loosePriceRaw);
    const packedPurchasePrice = parsePrice(packedPurchasePriceRaw);
    const packedMarketPrice = parsePrice(packedMarketPriceRaw);
    const packedOriginalPrice = parsePrice(packedOriginalPriceRaw);
    const loosePurchasePrice = parsePrice(loosePurchasePriceRaw);
    const looseMarketPrice = parsePrice(looseMarketPriceRaw);

    // Prepare update data - include all fields that were sent (even if null)
    // This allows users to clear prices by sending empty strings
    const updateData: any = {};
    
    // Always include fields that were sent in the form (even if null)
    // This way users can clear prices by leaving them empty
    if (packedPriceRaw !== null) updateData.packedPrice = packedPrice;
    if (loosePriceRaw !== null) updateData.loosePrice = loosePrice;
    if (packedPurchasePriceRaw !== null) updateData.packedPurchasePrice = packedPurchasePrice;
    if (packedMarketPriceRaw !== null) updateData.packedMarketPrice = packedMarketPrice;
    if (packedOriginalPriceRaw !== null) updateData.packedOriginalPrice = packedOriginalPrice;
    if (loosePurchasePriceRaw !== null) updateData.loosePurchasePrice = loosePurchasePrice;
    if (looseMarketPriceRaw !== null) updateData.looseMarketPrice = looseMarketPrice;

    console.log('Updating model:', id);
    console.log('Raw form data:', {
      packedPriceRaw,
      loosePriceRaw,
      packedPurchasePriceRaw,
      packedMarketPriceRaw,
      packedOriginalPriceRaw,
      loosePurchasePriceRaw,
      looseMarketPriceRaw,
    });
    console.log('Parsed prices:', {
      packedPrice,
      loosePrice,
      packedPurchasePrice,
      packedMarketPrice,
      packedOriginalPrice,
      loosePurchasePrice,
      looseMarketPrice,
    });
    console.log('Update data:', updateData);

    const updatedModel = await prisma.model.update({
      where: { id },
      data: updateData,
    });

    console.log('Model updated successfully:', updatedModel.id);

    // Revalidate all relevant paths
    revalidatePath('/collections', 'layout');
    revalidatePath('/variants', 'layout');
    revalidatePath(`/variants/[variantId]`, 'page');
    return NextResponse.json({ success: true, modelId: updatedModel.id });
  } catch (error) {
    console.error('Error updating model price:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}

