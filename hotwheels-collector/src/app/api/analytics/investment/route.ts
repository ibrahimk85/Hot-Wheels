import { NextRequest, NextResponse } from 'next/server';
import {
  getInvestmentAnalysis,
  calculateROI,
  estimateCollectionValue,
} from '@/features/analytics/investment-analysis.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const modelId = searchParams.get('modelId');
    const months = searchParams.get('months');

    if (type === 'roi' && modelId) {
      const roi = await calculateROI(parseInt(modelId));
      return NextResponse.json(roi);
    }

    if (type === 'estimate') {
      const estimate = await estimateCollectionValue(
        months ? parseInt(months) : 12
      );
      return NextResponse.json(estimate);
    }

    // Default: full investment analysis
    const analysis = await getInvestmentAnalysis();
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching investment analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment analysis' },
      { status: 500 }
    );
  }
}



