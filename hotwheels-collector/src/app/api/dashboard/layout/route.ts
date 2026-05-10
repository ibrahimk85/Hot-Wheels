import { NextRequest, NextResponse } from 'next/server';
import {
  getDefaultDashboardLayout,
  createDashboardLayout,
  getAllDashboardLayouts,
} from '@/features/dashboard/dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { withAuth } from '@/lib/auth';

export const GET = apiHandler(
  withAuth(async (user, request) => {
    const searchParams = request.nextUrl.searchParams;
    const defaultOnly = searchParams.get('default') === 'true';

    if (defaultOnly) {
      let layout = await getDefaultDashboardLayout(user.id);
      if (!layout) {
        // Varsayılan layout yoksa oluştur
        const { createDefaultDashboardLayout } = await import(
          '@/features/dashboard/dashboard.service'
        );
        layout = await createDefaultDashboardLayout(user.id);
      }
      return NextResponse.json(layout);
    }

    // Get user-specific layouts
    const layouts = await getAllDashboardLayouts(user.id);
    return NextResponse.json(layouts);
  })
);

export const POST = apiHandler(
  withAuth(async (user, request) => {
    const body = await request.json();
    const { name, isDefault } = body;

    if (!name) {
      throw new Error('Name is required');
    }

    const layout = await createDashboardLayout(name, user.id, isDefault || false);
    return NextResponse.json(layout);
  })
);

