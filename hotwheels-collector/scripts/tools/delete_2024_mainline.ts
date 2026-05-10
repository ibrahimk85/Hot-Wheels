import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const TARGET_YEAR = 2024;
const MAINLINE_NAME = 'Mainline';

async function delete2024Mainline() {
  console.log('=== Delete 2024 Mainline Data & Images ===\n');

  // 1) Find 2024 Mainline collection
  const collection = await prisma.collection.findFirst({
    where: {
      name: MAINLINE_NAME,
      year: {
        year: TARGET_YEAR,
      },
    },
    include: {
      year: true,
    },
  });

  if (!collection) {
    console.log(`No collection found for year ${TARGET_YEAR} and name "${MAINLINE_NAME}". Nothing to delete.`);
    return;
  }

  console.log(`Found collection: id=${collection.id}, name=${collection.name}, year=${collection.year.year}`);

  // 2) Collect all models under this collection
  const models = await prisma.model.findMany({
    where: {
      collectionId: collection.id,
    },
    select: { id: true },
  });

  const modelIds = models.map(m => m.id);
  console.log(`Models under 2024 Mainline: ${modelIds.length}`);

  // 3) Delete variants (2024 + models in this collection)
  const deleteVariantsResult = await prisma.variant.deleteMany({
    where: {
      year: TARGET_YEAR,
      model: {
        collectionId: collection.id,
      },
    },
  });
  console.log(`Deleted variants: ${deleteVariantsResult.count}`);

  // 4) Delete images related to 2024 Mainline
  const deleteImagesResult = await prisma.image.deleteMany({
    where: {
      OR: [
        // Images stored under the 2024 mainline path
        {
          path: {
            startsWith: '/images/hotwheels/2024/mainline/',
          },
        },
        // Images attached to variants whose models are in this collection
        {
          variant: {
            model: {
              collectionId: collection.id,
            },
          },
        },
        // Images attached directly to models in this collection
        {
          model: {
            collectionId: collection.id,
          },
        },
      ],
    },
  });
  console.log(`Deleted images: ${deleteImagesResult.count}`);

  // 5) Delete models themselves (after variants/images are gone)
  const deleteModelsResult = await prisma.model.deleteMany({
    where: {
      id: { in: modelIds },
    },
  });
  console.log(`Deleted models: ${deleteModelsResult.count}`);

  // 6) Filesystem cleanup for 2024 mainline images
  const mainlineDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2024', 'mainline');
  console.log(`\nChecking filesystem folder: ${mainlineDir}`);

  if (fs.existsSync(mainlineDir)) {
    console.log('Folder exists. Removing recursively...');
    await fs.promises.rm(mainlineDir, { recursive: true, force: true });
    console.log('Folder removed.');
  } else {
    console.log('Folder does not exist. Skipping filesystem removal.');
  }

  // 7) Verification
  console.log('\n=== Verification ===');

  const remainingVariants = await prisma.variant.count({
    where: {
      year: TARGET_YEAR,
      model: {
        collection: {
          name: MAINLINE_NAME,
          year: {
            year: TARGET_YEAR,
          },
        },
      },
    },
  });

  const remainingImages = await prisma.image.count({
    where: {
      path: {
        startsWith: '/images/hotwheels/2024/mainline/',
      },
    },
  });

  const mainlineDirPath = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2024', 'mainline');
  const folderExistsAfter = fs.existsSync(mainlineDirPath);

  console.log(`Remaining variants for 2024 Mainline: ${remainingVariants}`);
  console.log(`Remaining images under /images/hotwheels/2024/mainline/: ${remainingImages}`);
  console.log(`Filesystem folder exists after delete: ${folderExistsAfter}`);

  console.log('\n=== Summary ===');
  console.log(`Collection: ${collection.name} (${collection.year.year})`);
  console.log(`Models deleted: ${deleteModelsResult.count}`);
  console.log(`Variants deleted: ${deleteVariantsResult.count}`);
  console.log(`Images deleted: ${deleteImagesResult.count}`);

  if (remainingVariants === 0 && remainingImages === 0 && !folderExistsAfter) {
    console.log('\n✅ 2024 Mainline data and images successfully removed.');
  } else {
    console.log('\n⚠ Some 2024 Mainline data or images may still remain. Please review the logs.');
  }
}

delete2024Mainline()
  .catch((err) => {
    console.error('❌ Error while deleting 2024 Mainline:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








