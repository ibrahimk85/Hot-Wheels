import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TARGET_YEAR = 2026;
const MAINLINE_NAME = 'Mainline';

export interface Delete2026MainlineResult {
  skippedNoCollection: boolean;
  collectionId?: number;
  modelsDeleted: number;
  variantsDeleted: number;
  imagesDeleted: number;
}

/**
 * Deletes all 2026 Mainline models, variants, related images, and the image folder on disk.
 * Does not remove Collection / Year / SubSeries rows.
 */
export async function delete2026MainlineData(prisma: PrismaClient): Promise<Delete2026MainlineResult> {
  console.log('=== Delete 2026 Mainline Data & Images ===\n');

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
    return {
      skippedNoCollection: true,
      modelsDeleted: 0,
      variantsDeleted: 0,
      imagesDeleted: 0,
    };
  }

  console.log(`Found collection: id=${collection.id}, name=${collection.name}, year=${collection.year.year}`);

  const models = await prisma.model.findMany({
    where: {
      collectionId: collection.id,
    },
    select: { id: true },
  });

  const modelIds = models.map(m => m.id);
  console.log(`Models under 2026 Mainline: ${modelIds.length}`);

  const deleteVariantsResult = await prisma.variant.deleteMany({
    where: {
      year: TARGET_YEAR,
      model: {
        collectionId: collection.id,
      },
    },
  });
  console.log(`Deleted variants: ${deleteVariantsResult.count}`);

  const deleteImagesResult = await prisma.image.deleteMany({
    where: {
      OR: [
        {
          path: {
            startsWith: '/images/hotwheels/2026/mainline/',
          },
        },
        {
          variant: {
            model: {
              collectionId: collection.id,
            },
          },
        },
        {
          model: {
            collectionId: collection.id,
          },
        },
      ],
    },
  });
  console.log(`Deleted images: ${deleteImagesResult.count}`);

  const deleteModelsResult = await prisma.model.deleteMany({
    where: {
      id: { in: modelIds },
    },
  });
  console.log(`Deleted models: ${deleteModelsResult.count}`);

  const mainlineDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2026', 'mainline');
  console.log(`\nChecking filesystem folder: ${mainlineDir}`);

  if (fs.existsSync(mainlineDir)) {
    console.log('Folder exists. Removing recursively...');
    await fs.promises.rm(mainlineDir, { recursive: true, force: true });
    console.log('Folder removed.');
  } else {
    console.log('Folder does not exist. Skipping filesystem removal.');
  }

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
        startsWith: '/images/hotwheels/2026/mainline/',
      },
    },
  });

  const mainlineDirPath = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2026', 'mainline');
  const folderExistsAfter = fs.existsSync(mainlineDirPath);

  console.log(`Remaining variants for 2026 Mainline: ${remainingVariants}`);
  console.log(`Remaining images under /images/hotwheels/2026/mainline/: ${remainingImages}`);
  console.log(`Filesystem folder exists after delete: ${folderExistsAfter}`);

  console.log('\n=== Summary ===');
  console.log(`Collection: ${collection.name} (${collection.year.year})`);
  console.log(`Models deleted: ${deleteModelsResult.count}`);
  console.log(`Variants deleted: ${deleteVariantsResult.count}`);
  console.log(`Images deleted: ${deleteImagesResult.count}`);

  if (remainingVariants === 0 && remainingImages === 0 && !folderExistsAfter) {
    console.log('\n✅ 2026 Mainline data and images successfully removed.');
  } else {
    console.log('\n⚠ Some 2026 Mainline data or images may still remain. Please review the logs.');
  }

  return {
    skippedNoCollection: false,
    collectionId: collection.id,
    modelsDeleted: deleteModelsResult.count,
    variantsDeleted: deleteVariantsResult.count,
    imagesDeleted: deleteImagesResult.count,
  };
}

async function delete2026Mainline() {
  const prisma = new PrismaClient();
  try {
    await delete2026MainlineData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  delete2026Mainline().catch((err) => {
    console.error('❌ Error while deleting 2026 Mainline:', err);
    process.exit(1);
  });
}









