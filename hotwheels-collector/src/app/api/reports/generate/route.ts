import { NextRequest, NextResponse } from 'next/server';
import {
  getSummaryReport,
  getCollectionReport,
  getYearReport,
  getValueReport,
  getMissingModelsReport,
} from '@/features/reports/report.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const yearParam = searchParams.get('year');
    const collectionIdParam = searchParams.get('collectionId');

    if (!type) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 }
      );
    }

    let reportData;

    switch (type) {
      case 'summary':
        reportData = await getSummaryReport(
          yearParam ? Number(yearParam) : undefined
        );
        break;

      case 'collection':
        if (!collectionIdParam) {
          return NextResponse.json(
            { error: 'collectionId is required for collection report' },
            { status: 400 }
          );
        }
        reportData = await getCollectionReport(Number(collectionIdParam));
        if (!reportData) {
          return NextResponse.json(
            { error: 'Collection not found' },
            { status: 404 }
          );
        }
        break;

      case 'year':
        if (!yearParam) {
          return NextResponse.json(
            { error: 'year is required for year report' },
            { status: 400 }
          );
        }
        reportData = await getYearReport(Number(yearParam));
        if (!reportData) {
          return NextResponse.json(
            { error: 'Year not found' },
            { status: 404 }
          );
        }
        break;

      case 'value':
        reportData = await getValueReport(
          yearParam ? Number(yearParam) : undefined
        );
        break;

      case 'missing':
        reportData = await getMissingModelsReport(
          collectionIdParam ? Number(collectionIdParam) : undefined,
          yearParam ? Number(yearParam) : undefined
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

