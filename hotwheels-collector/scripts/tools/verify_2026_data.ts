/**
 * Verification script to check 2026 data
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying 2026 Mainline Data...\n');

  // Check Year
  const year2026 = await prisma.year.findFirst({ where: { year: 2026 } });
  console.log(`Year 2026: ${year2026 ? '✅ Exists' : '❌ Not found'}`);

  if (!year2026) {
    console.log('\n⚠️  Year 2026 not found. The scraping script may not have run yet.');
    await prisma.$disconnect();
    return;
  }

  // Check Collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: { name: 'Mainline', yearId: year2026.id },
    include: {
      _count: {
        select: {
          models: true,
          subSeries: true,
        },
      },
    },
  });
  console.log(`Mainline Collection: ${mainlineCollection ? '✅ Exists' : '❌ Not found'}`);

  if (!mainlineCollection) {
    console.log('\n⚠️  Mainline collection not found for 2026.');
    await prisma.$disconnect();
    return;
  }

  console.log(`  - SubSeries count: ${mainlineCollection._count.subSeries}`);
  console.log(`  - Models count: ${mainlineCollection._count.models}`);

  // Check SubSeries
  const subSeries = await prisma.subSeries.findMany({
    where: { collectionId: mainlineCollection.id },
    include: {
      _count: {
        select: { models: true },
      },
    },
  });
  console.log(`\nSubSeries found: ${subSeries.length}`);
  if (subSeries.length > 0) {
    console.log('  Top 5 SubSeries:');
    subSeries.slice(0, 5).forEach(ss => {
      console.log(`    - ${ss.name}: ${ss._count.models} models`);
    });
  }

  // Check Models
  const models = await prisma.model.findMany({
    where: { collectionId: mainlineCollection.id },
    include: {
      _count: {
        select: { variants: true },
      },
    },
    take: 10,
  });
  console.log(`\nModels found: ${models.length} (showing first 10)`);
  if (models.length > 0) {
    models.forEach(m => {
      console.log(`    - ${m.castingName} (${m._count.variants} variants)`);
    });
  }

  // Check Variants
  const variants = await prisma.variant.findMany({
    where: {
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: true,
    },
  });
  console.log(`\nVariants found: ${variants.length}`);
  
  const thCount = variants.filter(v => v.isTreasureHunt).length;
  const sthCount = variants.filter(v => v.isSuperTreasureHunt).length;
  console.log(`  - Treasure Hunts: ${thCount}`);
  console.log(`  - Super Treasure Hunts: ${sthCount}`);

  // Check Images
  const images = await prisma.image.findMany({
    where: {
      variant: {
        model: {
          collectionId: mainlineCollection.id,
        },
      },
    },
  });
  console.log(`\nImages found: ${images.length}`);

  // Check file system
  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2026', 'mainline');
  const imageDirExists = fs.existsSync(imageDir);
  console.log(`\nImage directory exists: ${imageDirExists ? '✅' : '❌'}`);
  
  if (imageDirExists) {
    const files = fs.readdirSync(imageDir, { recursive: true });
    const imageFiles = files.filter((f): f is string => typeof f === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    console.log(`  - Image files found: ${imageFiles.length}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Year: ${year2026 ? '✅' : '❌'}`);
  console.log(`Collection: ${mainlineCollection ? '✅' : '❌'}`);
  console.log(`SubSeries: ${subSeries.length}`);
  console.log(`Models: ${mainlineCollection._count.models}`);
  console.log(`Variants: ${variants.length}`);
  console.log(`Images (DB): ${images.length}`);
  console.log(`TH: ${thCount}`);
  console.log(`STH: ${sthCount}`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());








