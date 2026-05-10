/**
 * Backup Creation Script
 * 
 * Creates a complete backup of:
 * - dev.db database file
 * - public/images directory (as zip)
 * - Git commit hash
 * - Package version
 * - Backup metadata
 * 
 * Usage: npx ts-node scripts/tools/create_backup.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import simpleGit from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root directory (hotwheels-collector)
const projectRoot = path.resolve(__dirname, '../..');
const backupsDir = path.join(projectRoot, 'backups');

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

async function main() {
  try {
    console.log('=== BACKUP CREATION STARTED ===\n');

    // Create timestamp for backup folder name
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
    const backupDir = path.join(backupsDir, timestamp);

    // Create backup directory
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup directory created: ${backupDir}\n`);

    // 1. Copy dev.db
    const dbSource = path.join(projectRoot, 'dev.db');
    const dbDest = path.join(backupDir, 'dev.db');

    if (fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, dbDest);
      const dbStats = fs.statSync(dbDest);
      console.log(`✓ Database backed up: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.log('⚠ Database file not found, skipping...');
    }

    // 2. Zip public/images directory
    const imagesDir = path.join(projectRoot, 'public', 'images');
    const imagesZipPath = path.join(backupDir, 'images.zip');

    if (fs.existsSync(imagesDir)) {
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(imagesZipPath);
        const archive = archiver('zip', {
          zlib: { level: 9 }, // Maximum compression
        });

        output.on('close', () => {
          const zipStats = fs.statSync(imagesZipPath);
          console.log(`✓ Images backed up: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB (${archive.pointer()} bytes total)`);
          resolve();
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);
        archive.directory(imagesDir, 'images');
        archive.finalize();
      });
    } else {
      console.log('⚠ Images directory not found, skipping...');
    }

    // 3. Get Git commit hash
    let gitCommitHash = 'unknown';
    let gitBranch = 'unknown';
    try {
      const git = simpleGit(projectRoot);
      const log = await git.log({ maxCount: 1 });
      if (log.latest) {
        gitCommitHash = log.latest.hash;
      }
      const branchSummary = await git.branchLocal();
      gitBranch = branchSummary.current;
    } catch (err) {
      console.log('⚠ Git information not available (not a git repo or git not installed)');
    }

    // 4. Get package.json version
    const packageJsonPath = path.join(projectRoot, 'package.json');
    let packageVersion = 'unknown';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageVersion = packageJson.version || 'unknown';
    }

    // 5. Create metadata JSON
    const metadata = {
      version: '1.0',
      timestamp: now.toISOString(),
      backupDate: timestamp,
      gitCommitHash,
      gitBranch,
      packageVersion,
      databaseSize: fs.existsSync(dbDest) ? fs.statSync(dbDest).size : 0,
      imagesZipSize: fs.existsSync(imagesZipPath) ? fs.statSync(imagesZipPath).size : 0,
      backupPath: backupDir,
    };

    const metadataPath = path.join(backupDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✓ Metadata saved`);

    // Summary
    console.log('\n=== BACKUP SUMMARY ===');
    console.log(`Backup Location: ${backupDir}`);
    console.log(`Git Commit: ${gitCommitHash.substring(0, 7)} (${gitBranch})`);
    console.log(`Package Version: ${packageVersion}`);
    console.log(`Backup Date: ${now.toLocaleString()}`);
    console.log('\n=== BACKUP COMPLETED SUCCESSFULLY ===\n');

    // List all backups
    const allBackups = fs.readdirSync(backupsDir)
      .filter((item) => {
        const itemPath = path.join(backupsDir, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort()
      .reverse();

    console.log(`Total backups: ${allBackups.length}`);
    if (allBackups.length > 0) {
      console.log('Recent backups:');
      allBackups.slice(0, 5).forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup}`);
      });
    }
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

main();




