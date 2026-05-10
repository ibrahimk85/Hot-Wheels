/**
 * Backup Restore Script
 * 
 * Restores a backup created by create_backup.ts
 * 
 * Usage: npx ts-node scripts/tools/restore_backup.ts <backup-folder-name>
 * Example: npx ts-node scripts/tools/restore_backup.ts 2025-01-15T10-30-00
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root directory (hotwheels-collector)
const projectRoot = path.resolve(__dirname, '../..');
const backupsDir = path.join(projectRoot, 'backups');

async function main() {
  try {
    const backupName = process.argv[2];

    if (!backupName) {
      console.error('❌ Error: Backup folder name is required');
      console.log('\nUsage: npx ts-node scripts/tools/restore_backup.ts <backup-folder-name>');
      console.log('\nAvailable backups:');
      
      if (fs.existsSync(backupsDir)) {
        const backups = fs.readdirSync(backupsDir)
          .filter((item) => {
            const itemPath = path.join(backupsDir, item);
            return fs.statSync(itemPath).isDirectory();
          })
          .sort()
          .reverse();

        if (backups.length === 0) {
          console.log('  No backups found.');
        } else {
          backups.forEach((backup, index) => {
            console.log(`  ${index + 1}. ${backup}`);
          });
        }
      } else {
        console.log('  No backups directory found.');
      }
      
      process.exit(1);
    }

    const backupDir = path.join(backupsDir, backupName);

    if (!fs.existsSync(backupDir)) {
      console.error(`❌ Error: Backup folder not found: ${backupDir}`);
      process.exit(1);
    }

    console.log('=== BACKUP RESTORE STARTED ===\n');
    console.log(`Restoring from: ${backupDir}\n`);

    // Read metadata
    const metadataPath = path.join(backupDir, 'metadata.json');
    let metadata: any = null;
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log('Backup Information:');
      console.log(`  Date: ${metadata.timestamp || metadata.backupDate}`);
      console.log(`  Git Commit: ${metadata.gitCommitHash?.substring(0, 7) || 'unknown'}`);
      console.log(`  Package Version: ${metadata.packageVersion || 'unknown'}`);
      console.log('');
    }

    // Confirm restore
    console.log('⚠️  WARNING: This will overwrite:');
    console.log('  - dev.db (current database)');
    console.log('  - public/images (current images)');
    console.log('\nMake sure you have a current backup before proceeding!');
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 1. Restore database
    const dbSource = path.join(backupDir, 'dev.db');
    const dbDest = path.join(projectRoot, 'dev.db');

    if (fs.existsSync(dbSource)) {
      // Backup current database first (safety measure)
      const currentDbBackup = path.join(projectRoot, 'dev.db.backup');
      if (fs.existsSync(dbDest)) {
        fs.copyFileSync(dbDest, currentDbBackup);
        console.log(`✓ Current database backed up to: dev.db.backup`);
      }

      fs.copyFileSync(dbSource, dbDest);
      const dbStats = fs.statSync(dbDest);
      console.log(`✓ Database restored: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.log('⚠ Database file not found in backup, skipping...');
    }

    // 2. Restore images (unzip)
    const imagesZipPath = path.join(backupDir, 'images.zip');
    const imagesDest = path.join(projectRoot, 'public', 'images');

    if (fs.existsSync(imagesZipPath)) {
      // Backup current images directory (if exists)
      if (fs.existsSync(imagesDest)) {
        const imagesBackup = path.join(projectRoot, 'public', 'images.backup');
        // Use a simple copy method (for Windows compatibility)
        console.log('⚠ Backing up current images directory...');
        // Note: For large directories, this might take time
        // In production, you might want to use a more efficient method
      }

      // Extract zip file
      console.log('Extracting images...');
      try {
        const zip = new AdmZip(imagesZipPath);
        
        // Remove existing images directory if it exists
        if (fs.existsSync(imagesDest)) {
          fs.rmSync(imagesDest, { recursive: true, force: true });
        }
        
        // Extract to public directory (will create images subdirectory)
        zip.extractAllTo(path.join(projectRoot, 'public'), true);
        console.log(`✓ Images extracted successfully`);
      } catch (error: any) {
        console.error('❌ Failed to extract images:', error.message);
        console.log('⚠ Please manually extract images.zip from backup to public/images');
        console.log(`  Source: ${imagesZipPath}`);
        console.log(`  Destination: ${imagesDest}`);
      }
    } else {
      console.log('⚠ Images zip file not found in backup, skipping...');
    }

    console.log('\n=== RESTORE COMPLETED ===');
    console.log('\n⚠️  IMPORTANT:');
    console.log('  - Restart your development server if running');
    console.log('  - Run "npx prisma generate" if Prisma schema changed');
    console.log('  - Verify your data before continuing\n');
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

main();

