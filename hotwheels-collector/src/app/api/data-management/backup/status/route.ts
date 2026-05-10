import { NextResponse } from 'next/server';
import { getBackupStatus } from '@/features/data-management/auto-backup.service';

export async function GET() {
  try {
    const status = await getBackupStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Backup status error:', error);
    return NextResponse.json(
      { error: 'Failed to get backup status' },
      { status: 500 }
    );
  }
}



