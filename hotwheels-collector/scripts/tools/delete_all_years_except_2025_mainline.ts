import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const PRESERVE_YEAR = 2025;
const MAINLINE_NAME = 'Mainline';

async function deleteAllYearsExcept2025Mainline() {
  console.log('=== Delete All Years Except 2025 Mainline Data & Images ===\n');

  // 1) Find all years except 2025
  const allYears = await prisma.year.findMany({
    where: {
      year: {
        not: PRESERVE_YEAR,
      },
    },
    include: {
      collections: {
        where: {
          name: MAINLINE_NAME,
        },
        include: {
          models: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (allYears.length === 0) {
    console.log(`No years found except ${PRESERVE_YEAR}. Nothing to delete.`);
    return;
  }

  console.log(`Found ${allYears.length} years to process (excluding ${PRESERVE_YEAR}):`);
  allYears.forEach((y) => {
    const mainlineCollection = y.collections.find((c) => c.name === MAINLINE_NAME);
    if (mainlineCollection) {
      console.log(`  - Year ${y.year}: Mainline collection with ${mainlineCollection.models.length} models`);
    } else {
      console.log(`  - Year ${y.year}: No Mainline collection found`);
    }
  });
  console.log('');

  let totalVariantsDeleted = 0;
  let totalImagesDeleted = 0;
  let totalModelsDeleted = 0;
  let totalSubSeriesDeleted = 0;
  let totalCollectionsDeleted = 0;
  let totalYearsDeleted = 0;
  const deletedImageFolders: string[] = [];

  // 2) Process each year
  for (const yearRecord of allYears) {
    const mainlineCollection = yearRecord.collections.find((c) => c.name === MAINLINE_NAME);
    
    if (!mainlineCollection) {
      console.log(`Skipping year ${yearRecord.year} - no Mainline collection found.`);
      continue;
    }

    console.log(`\n=== Processing Year ${yearRecord.year} ===`);

    const modelIds = mainlineCollection.models.map((m) => m.id);
    console.log(`  Models in Mainline collection: ${modelIds.length}`);

    // 3) Delete variants (for this year and models in this collection)
    const deleteVariantsResult = await prisma.variant.deleteMany({
      where: {
        year: yearRecord.year,
        model: {
          collectionId: mainlineCollection.id,
        },
      },
    });
    totalVariantsDeleted += deleteVariantsResult.count;
    console.log(`  Deleted variants: ${deleteVariantsResult.count}`);

    // 4) Delete images related to this year's Mainline
    // Delete images by path pattern
    const yearImagePath = `/images/hotwheels/${yearRecord.year}/mainline/`;
    const deleteImagesByPath = await prisma.image.deleteMany({
      where: {
        path: {
          startsWith: yearImagePath,
        },
      },
    });

    // Delete images attached to variants whose models are in this collection
    const deleteImagesByVariant = await prisma.image.deleteMany({
      where: {
        variant: {
          model: {
            collectionId: mainlineCollection.id,
          },
        },
      },
    });

    // Delete images attached directly to models in this collection
    const deleteImagesByModel = await prisma.image.deleteMany({
      where: {
        model: {
          collectionId: mainlineCollection.id,
        },
      },
    });

    const totalImagesForYear = deleteImagesByPath.count + deleteImagesByVariant.count + deleteImagesByModel.count;
    totalImagesDeleted += totalImagesForYear;
    console.log(`  Deleted images: ${totalImagesForYear} (by path: ${deleteImagesByPath.count}, by variant: ${deleteImagesByVariant.count}, by model: ${deleteImagesByModel.count})`);

    // 5) Delete SubSeries for this collection
    const deleteSubSeriesResult = await prisma.subSeries.deleteMany({
      where: {
        collectionId: mainlineCollection.id,
      },
    });
    totalSubSeriesDeleted += deleteSubSeriesResult.count;
    console.log(`  Deleted SubSeries: ${deleteSubSeriesResult.count}`);

    // 6) Delete models themselves (after variants/images are gone)
    const deleteModelsResult = await prisma.model.deleteMany({
      where: {
        id: { in: modelIds },
      },
    });
    totalModelsDeleted += deleteModelsResult.count;
    console.log(`  Deleted models: ${deleteModelsResult.count}`);

    // 7) Delete the Mainline collection
    const deleteCollectionResult = await prisma.collection.deleteMany({
      where: {
        id: mainlineCollection.id,
      },
    });
    totalCollectionsDeleted += deleteCollectionResult.count;
    console.log(`  Deleted collection: ${deleteCollectionResult.count}`);

    // 8) Check if year has any other collections, if not, delete the year
    const remainingCollections = await prisma.collection.count({
      where: {
        yearId: yearRecord.id,
      },
    });

    if (remainingCollections === 0) {
      const deleteYearResult = await prisma.year.deleteMany({
        where: {
          id: yearRecord.id,
        },
      });
      totalYearsDeleted += deleteYearResult.count;
      console.log(`  Deleted year record: ${deleteYearResult.count}`);
    } else {
      console.log(`  Year record kept (has ${remainingCollections} other collections)`);
    }

    // 9) Filesystem cleanup for this year's mainline images
    const mainlineDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearRecord.year.toString(), 'mainline');
    console.log(`  Checking filesystem folder: ${mainlineDir}`);

    if (fs.existsSync(mainlineDir)) {
      console.log('  Folder exists. Removing recursively...');
      await fs.promises.rm(mainlineDir, { recursive: true, force: true });
      deletedImageFolders.push(mainlineDir);
      console.log('  Folder removed.');
    } else {
      console.log('  Folder does not exist. Skipping filesystem removal.');
    }
  }

  // 10) Verification
  console.log('\n=== Verification ===');

  // Check remaining Mainline data for non-2025 years
  const remainingYears = await prisma.year.findMany({
    where: {
      year: {
        not: PRESERVE_YEAR,
      },
    },
    include: {
      collections: {
        where: {
          name: MAINLINE_NAME,
        },
      },
    },
  });

  const remainingMainlineCollections = remainingYears.filter((y) => y.collections.length > 0);
  console.log(`Years with remaining Mainline collections (excluding ${PRESERVE_YEAR}): ${remainingMainlineCollections.length}`);
  remainingMainlineCollections.forEach((y) => {
    console.log(`  - Year ${y.year}: ${y.collections.length} Mainline collection(s)`);
  });

  // Check remaining variants
  const remainingVariants = await prisma.variant.count({
    where: {
      year: {
        not: PRESERVE_YEAR,
      },
      model: {
        collection: {
          name: MAINLINE_NAME,
        },
      },
    },
  });
  console.log(`Remaining variants for non-${PRESERVE_YEAR} Mainline: ${remainingVariants}`);

  // Check remaining images by path pattern
  const remainingImages = await prisma.image.count({
    where: {
      OR: [
        {
          path: {
            contains: '/hotwheels/',
            not: {
              startsWith: `/images/hotwheels/${PRESERVE_YEAR}/mainline/`,
            },
          },
        },
        {
          variant: {
            year: {
              not: PRESERVE_YEAR,
            },
            model: {
              collection: {
                name: MAINLINE_NAME,
              },
            },
          },
        },
        {
          model: {
            collection: {
              name: MAINLINE_NAME,
              year: {
                year: {
                  not: PRESERVE_YEAR,
                },
              },
            },
          },
        },
      ],
    },
  });
  console.log(`Remaining images for non-${PRESERVE_YEAR} Mainline: ${remainingImages}`);

  // Check filesystem folders
  const hotwheelsBaseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels');
  let remainingFolders: string[] = [];
  if (fs.existsSync(hotwheelsBaseDir)) {
    const yearDirs = await fs.promises.readdir(hotwheelsBaseDir, { withFileTypes: true });
    for (const yearDir of yearDirs) {
      if (yearDir.isDirectory() && yearDir.name !== PRESERVE_YEAR.toString()) {
        const mainlinePath = path.join(hotwheelsBaseDir, yearDir.name, 'mainline');
        if (fs.existsSync(mainlinePath)) {
          remainingFolders.push(mainlinePath);
        }
      }
    }
  }
  console.log(`Remaining mainline image folders (excluding ${PRESERVE_YEAR}): ${remainingFolders.length}`);
  remainingFolders.forEach((folder) => {
    console.log(`  - ${folder}`);
  });

  // Verify 2025 data is preserved
  console.log('\n=== 2025 Data Preservation Check ===');
  const year2025 = await prisma.year.findFirst({
    where: { year: PRESERVE_YEAR },
    include: {
      collections: {
        where: {
          name: MAINLINE_NAME,
        },
        include: {
          models: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (year2025) {
    const mainline2025 = year2025.collections.find((c) => c.name === MAINLINE_NAME);
    if (mainline2025) {
      const variants2025 = await prisma.variant.count({
        where: {
          year: PRESERVE_YEAR,
          model: {
            collectionId: mainline2025.id,
          },
        },
      });
      const images2025 = await prisma.image.count({
        where: {
          OR: [
            {
              path: {
                startsWith: `/images/hotwheels/${PRESERVE_YEAR}/mainline/`,
              },
            },
            {
              variant: {
                model: {
                  collectionId: mainline2025.id,
                },
              },
            },
            {
              model: {
                collectionId: mainline2025.id,
              },
            },
          ],
        },
      });
      const folder2025 = path.join(process.cwd(), 'public', 'images', 'hotwheels', PRESERVE_YEAR.toString(), 'mainline');
      const folder2025Exists = fs.existsSync(folder2025);

      console.log(`2025 Mainline Collection: ${mainline2025.models.length} models`);
      console.log(`2025 Mainline Variants: ${variants2025}`);
      console.log(`2025 Mainline Images: ${images2025}`);
      console.log(`2025 Mainline Folder exists: ${folder2025Exists}`);

      if (mainline2025.models.length > 0 && variants2025 > 0) {
        console.log('✅ 2025 Mainline data is preserved.');
      } else {
        console.log('⚠️  Warning: 2025 Mainline data may be incomplete.');
      }
    } else {
      console.log('⚠️  Warning: 2025 Mainline collection not found.');
    }
  } else {
    console.log('⚠️  Warning: Year 2025 not found in database.');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Years processed: ${allYears.length}`);
  console.log(`Variants deleted: ${totalVariantsDeleted}`);
  console.log(`Images deleted: ${totalImagesDeleted}`);
  console.log(`Models deleted: ${totalModelsDeleted}`);
  console.log(`SubSeries deleted: ${totalSubSeriesDeleted}`);
  console.log(`Collections deleted: ${totalCollectionsDeleted}`);
  console.log(`Years deleted: ${totalYearsDeleted}`);
  console.log(`Image folders deleted: ${deletedImageFolders.length}`);
  deletedImageFolders.forEach((folder) => {
    console.log(`  - ${folder}`);
  });

  if (remainingVariants === 0 && remainingImages === 0 && remainingFolders.length === 0 && remainingMainlineCollections.length === 0) {
    console.log('\n✅ All non-2025 Mainline data and images successfully removed.');
  } else {
    console.log('\n⚠️  Some non-2025 Mainline data or images may still remain. Please review the logs.');
  }
}

deleteAllYearsExcept2025Mainline()
  .catch((err) => {
    console.error('❌ Error while deleting non-2025 Mainline data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










