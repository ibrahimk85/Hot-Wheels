import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:mm format
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  maxBackups?: number; // Maximum number of backups to keep
}

/**
 * Otomatik yedekleme zamanlaması kontrolü
 * Bu fonksiyon bir cron job veya scheduled task tarafından çağrılmalı
 */
export async function checkAndRunScheduledBackup(): Promise<{
  success: boolean;
  message: string;
  backupPath?: string;
}> {
  try {
    // Backup schedule'ı kontrol et (settings veya config dosyasından)
    // Şimdilik her gün çalışacak şekilde ayarlanmış
    const schedule: BackupSchedule = {
      enabled: true,
      frequency: 'daily',
      maxBackups: 30, // Son 30 backup'ı tut
    };

    if (!schedule.enabled) {
      return { success: false, message: 'Otomatik yedekleme devre dışı' };
    }

    // Backup script'ini çalıştır
    const projectRoot = process.cwd();
    const backupScript = path.join(projectRoot, 'scripts', 'tools', 'create_backup.ts');

    if (!fs.existsSync(backupScript)) {
      return { success: false, message: 'Backup script bulunamadı' };
    }

    // npm run backup:create komutunu çalıştır
    const { stdout, stderr } = await execAsync('npm run backup:create', {
      cwd: projectRoot,
    });

    if (stderr && !stderr.includes('Warning')) {
      return { success: false, message: `Backup hatası: ${stderr}` };
    }

    // Eski backup'ları temizle
    if (schedule.maxBackups) {
      await cleanupOldBackups(schedule.maxBackups);
    }

    return {
      success: true,
      message: 'Otomatik yedekleme başarıyla tamamlandı',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Backup hatası: ${error.message}`,
    };
  }
}

/**
 * Eski backup'ları temizle
 */
async function cleanupOldBackups(maxBackups: number): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const backupsDir = path.join(projectRoot, 'backups');

    if (!fs.existsSync(backupsDir)) {
      return;
    }

    const backups = fs
      .readdirSync(backupsDir)
      .filter((item) => {
        const itemPath = path.join(backupsDir, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort()
      .reverse();

    // Eski backup'ları sil
    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      for (const backup of toDelete) {
        const backupPath = path.join(backupsDir, backup);
        fs.rmSync(backupPath, { recursive: true, force: true });
        console.log(`Eski backup silindi: ${backup}`);
      }
    }
  } catch (error) {
    console.error('Backup temizleme hatası:', error);
  }
}

/**
 * Backup durumunu kontrol et
 */
export async function getBackupStatus(): Promise<{
  lastBackup: Date | null;
  totalBackups: number;
  totalSize: number; // bytes
  oldestBackup: Date | null;
  newestBackup: Date | null;
}> {
  const projectRoot = process.cwd();
  const backupsDir = path.join(projectRoot, 'backups');

  if (!fs.existsSync(backupsDir)) {
    return {
      lastBackup: null,
      totalBackups: 0,
      totalSize: 0,
      oldestBackup: null,
      newestBackup: null,
    };
  }

  const backups = fs
    .readdirSync(backupsDir)
    .filter((item) => {
      const itemPath = path.join(backupsDir, item);
      return fs.statSync(itemPath).isDirectory();
    })
    .sort();

  if (backups.length === 0) {
    return {
      lastBackup: null,
      totalBackups: 0,
      totalSize: 0,
      oldestBackup: null,
      newestBackup: null,
    };
  }

  let totalSize = 0;
  const backupDates: Date[] = [];

  for (const backup of backups) {
    const backupPath = path.join(backupsDir, backup);
    const stats = fs.statSync(backupPath);
    totalSize += stats.size;

    // Backup klasöründeki dosyaların toplam boyutunu hesapla
    const files = fs.readdirSync(backupPath);
    for (const file of files) {
      const filePath = path.join(backupPath, file);
      const fileStats = fs.statSync(filePath);
      totalSize += fileStats.size;
    }

    // Timestamp'ten tarih çıkar
    try {
      const date = new Date(backup.replace(/-/g, ':').replace('T', ' '));
      backupDates.push(date);
    } catch {
      // Tarih parse edilemezse atla
    }
  }

  backupDates.sort();

  return {
    lastBackup: backupDates.length > 0 ? backupDates[backupDates.length - 1] : null,
    totalBackups: backups.length,
    totalSize,
    oldestBackup: backupDates.length > 0 ? backupDates[0] : null,
    newestBackup: backupDates.length > 0 ? backupDates[backupDates.length - 1] : null,
  };
}



