import { NextResponse } from 'next/server';
import prisma from '@/db';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  try {
    const { variantId } = await params;
    const id = Number(variantId);
    
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 });
    }

    const variant = await prisma.variant.findUnique({
      where: { id },
    });

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    await prisma.variant.update({
      where: { id },
      data: { looseOwned: !variant.looseOwned },
    });

    revalidatePath(`/variants/${id}`);
    revalidatePath('/variants');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling loose owned:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}








