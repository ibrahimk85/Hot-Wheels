import { NextResponse } from 'next/server';
import { getVariantById } from '@/features/variants/variant.service';
import { apiHandler } from '@/lib/api-handler';
import { NotFoundError } from '@/lib/errors';

export const GET = apiHandler(async (request, { params }) => {
  const { variantId } = await params;
  const id = Number(variantId);
  
  if (Number.isNaN(id) || id <= 0) {
    throw new Error('Invalid variant ID');
  }

  try {
    const variant = await getVariantById(id);
    return NextResponse.json(variant);
  } catch (error) {
    if (error instanceof Error && error.message === 'Variant not found') {
      throw new NotFoundError('Variant');
    }
    throw error;
  }
});


