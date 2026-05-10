/**
 * Script to clean up Team Transport 2018-2019 data and images
 * 
 * This script will:
 * 1. Delete all Image records associated with Team Transport 2018-2019 variants
 * 2. Delete all Variant records for Team Transport 2018-2019
 * 3. Delete all Model records for Team Transport 2018-2019
 * 4. Delete all SubSeries records for Team Transport 2018-2019 (if empty)
 * 5. Delete all physical image files from public/images/hotwheels/2018/team-transport and 2019/team-transport
 * 
 * WARNING: This will permanently delete all Team Transport 2018-2019 data!
 * 
 * Usage:
 *   npx ts-node scripts/tools/cleanup_team_transport_2018_2019.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TARGET_YEARS = [2018, 2019];
const COLLECTION_NAME = 'Team Transport';

async function deleteDirectory(dirPath: string): Promise<void> {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        await deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(dirPath);
    console.log(`Deleted directory: ${dirPath}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('Team Transport 2018-2019 Temizleme');
  console.log('========================================');
  console.log('');

  for (const year of TARGET_YEARS) {
    console.log(`\n${year} yılı için temizleme başlatılıyor...`);

    // Find Collection
    const collection = await prisma.collection.findFirst({
      where: {
        name: COLLECTION_NAME,
        year: { year: year },
      },
      include: {
        subSeries: {
          include: {
            models: {
              include: {
                variants: {
                  include: {
                    images: true,
                  },
                },
                images: true,
              },
            },
          },
        },
      },
    });

    if (!collection) {
      console.log(`  ${year}: Collection bulunamadı, atlanıyor...`);
      continue;
    }

    console.log(`  Collection bulundu: ${collection.name} (ID: ${collection.id})`);

    let totalImagesDeleted = 0;
    let totalVariantsDeleted = 0;
    let totalModelsDeleted = 0;

    // Process each SubSeries
    for (const subSeries of collection.subSeries) {
      console.log(`  SubSeries: ${subSeries.name} (ID: ${subSeries.id})`);

      // Process each Model
      for (const model of subSeries.models) {
        console.log(`    Model: ${model.castingName} (ID: ${model.id})`);

        // Delete Model's main images
        if (model.images && model.images.length > 0) {
          for (const image of model.images) {
            // Delete physical file
            if (image.path) {
              const imagePath = path.join(process.cwd(), 'public', image.path);
              if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log(`      Deleted image file: ${image.path}`);
              }
            }
            // Delete database record
            await prisma.image.delete({
              where: { id: image.id },
            });
            totalImagesDeleted++;
          }
        }

        // Process Variants
        for (const variant of model.variants) {
          console.log(`      Variant: ${variant.releaseName || 'N/A'} (ID: ${variant.id})`);

          // Delete Variant's images
          if (variant.images && variant.images.length > 0) {
            for (const image of variant.images) {
              // Delete physical file
              if (image.path) {
                const imagePath = path.join(process.cwd(), 'public', image.path);
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                  console.log(`        Deleted image file: ${image.path}`);
                }
              }
              // Delete database record
              await prisma.image.delete({
                where: { id: image.id },
              });
              totalImagesDeleted++;
            }
          }

          // Delete Variant
          await prisma.variant.delete({
            where: { id: variant.id },
          });
          totalVariantsDeleted++;
        }

        // Clear mainImageId if set
        if (model.mainImageId) {
          await prisma.model.update({
            where: { id: model.id },
            data: { mainImageId: null },
          });
        }

        // Delete Model
        await prisma.model.delete({
          where: { id: model.id },
        });
        totalModelsDeleted++;
      }

      // Delete SubSeries if empty
      const remainingModels = await prisma.model.count({
        where: { subSeriesId: subSeries.id },
      });

      if (remainingModels === 0) {
        await prisma.subSeries.delete({
          where: { id: subSeries.id },
        });
        console.log(`    SubSeries silindi: ${subSeries.name}`);
      }
    }

    // Delete Collection if empty
    const remainingSubSeries = await prisma.subSeries.count({
      where: { collectionId: collection.id },
    });

    if (remainingSubSeries === 0) {
      await prisma.collection.delete({
        where: { id: collection.id },
      });
      console.log(`  Collection silindi: ${collection.name}`);
    }

    // Delete image directories
    const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', year.toString(), 'team-transport');
    await deleteDirectory(imageDir);

    console.log(`\n${year} yılı temizleme tamamlandı:`);
    console.log(`  - ${totalImagesDeleted} Image kaydı silindi`);
    console.log(`  - ${totalVariantsDeleted} Variant kaydı silindi`);
    console.log(`  - ${totalModelsDeleted} Model kaydı silindi`);
  }

  console.log('\n========================================');
  console.log('Tüm temizleme işlemleri tamamlandı!');
  console.log('========================================');
}

main()
  .catch((err) => {
    console.error('Hata:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


