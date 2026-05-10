/**
 * Script to check the status of COL# 366+ variants for 2018
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking COL# 366+ variants for 2018...\n');

  const variants = await prisma.variant.findMany({
    where: {
      year: 2018,
      cardNumber: { gte: '366' },
    },
    include: {
      images: true,
      model: {
        include: {
          subSeries: true,
          collection: true,
        },
      },
    },
    orderBy: {
      cardNumber: 'asc',
    },
  });

  console.log(`Total COL# 366+ variants: ${variants.length}\n`);

  let missingImageId = 0;
  let missingFile = 0;
  let hasBoth = 0;
  let hasImageRecordButNoFile = 0;
  let hasFileButNoImageId = 0;

  const issues: Array<{
    toyNumber: string | null;
    cardNumber: string | null;
    modelName: string;
    issue: string;
  }> = [];

  for (const v of variants) {
    const modelName = v.model.castingName;
    
    if (!v.imageId) {
      missingImageId++;
      // Check if there's an image record linked to this variant
      if (v.images && v.images.length > 0) {
        hasFileButNoImageId++;
        issues.push({
          toyNumber: v.toyNumber,
          cardNumber: v.cardNumber,
          modelName,
          issue: 'Has image record but no imageId set',
        });
      } else {
        issues.push({
          toyNumber: v.toyNumber,
          cardNumber: v.cardNumber,
          modelName,
          issue: 'No imageId and no image records',
        });
      }
    } else {
      const image = await prisma.image.findUnique({
        where: { id: v.imageId },
      });
      
      if (image) {
        const filePath = path.join(process.cwd(), 'public', image.path);
        if (!fs.existsSync(filePath)) {
          missingFile++;
          hasImageRecordButNoFile++;
          issues.push({
            toyNumber: v.toyNumber,
            cardNumber: v.cardNumber,
            modelName,
            issue: `Image record exists but file missing: ${image.path}`,
          });
        } else {
          hasBoth++;
        }
      } else {
        missingImageId++;
        issues.push({
          toyNumber: v.toyNumber,
          cardNumber: v.cardNumber,
          modelName,
          issue: 'imageId points to non-existent image record',
        });
      }
    }
  }

  console.log('Summary:');
  console.log(`  ✓ Has both imageId and file: ${hasBoth}`);
  console.log(`  ✗ Missing imageId: ${missingImageId}`);
  console.log(`  ✗ Missing file (but has imageId): ${missingFile}`);
  console.log(`  ⚠️  Has image record but no imageId: ${hasFileButNoImageId}`);
  console.log(`  ⚠️  Has imageId but file missing: ${hasImageRecordButNoFile}\n`);

  if (issues.length > 0) {
    console.log(`\nFound ${issues.length} issues:\n`);
    issues.slice(0, 20).forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue.modelName} (COL#: ${issue.cardNumber}, Toy#: ${issue.toyNumber})`);
      console.log(`   Issue: ${issue.issue}\n`);
    });
    if (issues.length > 20) {
      console.log(`... and ${issues.length - 20} more issues\n`);
    }
  }

  // Check image files in filesystem
  console.log('\nChecking image files in filesystem...');
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'mainline');
  if (fs.existsSync(imageDir)) {
    const subDirs = fs.readdirSync(imageDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    
    console.log(`Found ${subDirs.length} subdirectories:`);
    subDirs.forEach(dir => {
      const dirPath = path.join(imageDir, dir);
      const files = fs.readdirSync(dirPath);
      console.log(`  ${dir}: ${files.length} files`);
    });
  } else {
    console.log('  Image directory does not exist!');
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });














