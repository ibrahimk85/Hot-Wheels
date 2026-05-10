import { NextRequest, NextResponse } from 'next/server';
import { exportVariants } from '@/features/data-management/export.service';
import { VariantFilters } from '@/features/variants/variant.service';
import prisma from '@/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query parameters
    const filters: VariantFilters = {};

    // year parametresi yearId olarak geliyor, year değerine çevir
    const yearId = searchParams.get('year');
    if (yearId) {
      const yearRecord = await prisma.year.findUnique({
        where: { id: parseInt(yearId) },
        select: { year: true },
      });
      if (yearRecord) {
        filters.year = yearRecord.year;
      }
    }

    const collectionId = searchParams.get('collectionId');
    if (collectionId) {
      filters.collectionId = parseInt(collectionId);
    }

    const subSeriesId = searchParams.get('subSeriesId');
    if (subSeriesId) {
      filters.subSeriesId = parseInt(subSeriesId);
    }

    const packedOwnedStatus = searchParams.get('packedOwnedStatus');
    if (packedOwnedStatus !== null) {
      filters.packedOwnedStatus = packedOwnedStatus === 'true';
    }

    const looseOwnedStatus = searchParams.get('looseOwnedStatus');
    if (looseOwnedStatus !== null) {
      filters.looseOwnedStatus = looseOwnedStatus === 'true';
    }

    const wishlistedStatus = searchParams.get('wishlistedStatus');
    if (wishlistedStatus !== null) {
      filters.wishlistedStatus = wishlistedStatus === 'true';
    }

    const onlyTH = searchParams.get('onlyTH');
    if (onlyTH !== null) {
      filters.onlyTH = onlyTH === 'true';
    }

    const onlySTH = searchParams.get('onlySTH');
    if (onlySTH !== null) {
      filters.onlySTH = onlySTH === 'true';
    }

    // Get format (default: excel)
    const format = (searchParams.get('format') || 'excel') as 'csv' | 'excel';

    // Debug: Log filters
    console.log('Export filters:', JSON.stringify(filters, null, 2));

    // Export variants
    const buffer = await exportVariants(filters, format);
    
    // Debug: Check buffer size
    console.log('Export buffer size:', buffer.length);

    // Build filename from filters
    const filenameParts: string[] = ['hotwheels-export'];
    
    // Add year if selected
    if (yearId) {
      const yearRecord = await prisma.year.findUnique({
        where: { id: parseInt(yearId) },
        select: { year: true },
      });
      if (yearRecord) {
        filenameParts.push(yearRecord.year.toString());
      }
    }
    
    // Add collection name if selected
    if (collectionId) {
      const collection = await prisma.collection.findUnique({
        where: { id: parseInt(collectionId) },
        select: { name: true },
      });
      if (collection) {
        // Clean collection name for filename (remove spaces, special chars)
        const cleanName = collection.name
          .replace(/[^a-zA-Z0-9]/g, '-')
          .replace(/-+/g, '-') // Replace multiple dashes with single dash
          .replace(/^-|-$/g, '') // Remove leading/trailing dashes
          .toLowerCase();
        if (cleanName) {
          filenameParts.push(cleanName);
        }
      }
    }
    
    // Add subSeries name if selected
    if (subSeriesId) {
      const subSeries = await prisma.subSeries.findUnique({
        where: { id: parseInt(subSeriesId) },
        select: { name: true },
      });
      if (subSeries) {
        // Clean subSeries name for filename
        const cleanName = subSeries.name
          .replace(/[^a-zA-Z0-9]/g, '-')
          .replace(/-+/g, '-') // Replace multiple dashes with single dash
          .replace(/^-|-$/g, '') // Remove leading/trailing dashes
          .toLowerCase();
        if (cleanName) {
          filenameParts.push(cleanName);
        }
      }
    }
    
    // Add status filters if selected
    if (packedOwnedStatus === 'true') {
      filenameParts.push('packed');
    }
    if (looseOwnedStatus === 'true') {
      filenameParts.push('loose');
    }
    if (wishlistedStatus === 'true') {
      filenameParts.push('wish');
    }
    
    // Add date
    filenameParts.push(new Date().toISOString().split('T')[0]);
    
    // Filter out empty parts and join
    const filteredParts = filenameParts.filter(part => part && part.length > 0);
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    // Join parts and ensure no trailing dashes or underscores
    const baseName = filteredParts.join('-').replace(/[-_]+$/, '');
    const filename = `${baseName}.${extension}`;

    // Set response headers
    const contentType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

