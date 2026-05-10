import { NextResponse } from 'next/server';
import { checkPriceAlerts } from '@/features/pricing/price-alert.service';

export async function POST() {
  try {
    // Bu endpoint bir cron job veya scheduled task tarafından çağrılabilir
    const triggeredAlerts = await checkPriceAlerts();
    return NextResponse.json({
      message: 'Price alerts checked',
      triggeredCount: triggeredAlerts.length,
      triggeredAlerts,
    });
  } catch (error) {
    console.error('Error checking price alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check price alerts' },
      { status: 500 }
    );
  }
}



