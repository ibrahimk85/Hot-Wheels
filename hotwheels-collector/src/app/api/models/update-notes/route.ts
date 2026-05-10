import { NextResponse } from 'next/server';
import prisma from '@/db';
import { revalidatePath } from 'next/cache';
import { apiHandler } from '@/lib/api-handler';
import { withAuth } from '@/lib/auth';

export const POST = apiHandler(
  withAuth(async (user, request) => {
    const formData = await request.formData();
    const idRaw = formData.get('id');
    const notes = formData.get('notes') as string;

    const id = Number(idRaw);
    if (Number.isNaN(id)) {
      throw new Error('Invalid model ID');
    }

    await prisma.model.update({
      where: { id },
      data: { notes: notes || null },
    });

    revalidatePath('/collections', 'layout');
    return NextResponse.json({ success: true });
  })
);

