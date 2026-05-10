import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const TARGET_YEAR = 2018;
const COLLECTION_NAME = 'Pop Culture';

async function delete2018PopCulture() {
  console.log('=== Delete 2018 Pop Culture Data & Images ===\n');

  // 1) Find 2018 Pop Culture collection
  const collection = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      year: {
        year: TARGET_YEAR,
      },
    },
    include: {
      year: true,
    },
  });

  if (!collection) {
    console.log(`No collection found for year ${TARGET_YEAR} and name "${COLLECTION_NAME}". Nothing to delete.`);
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
  console.log(`Models under 2018 Pop Culture: ${modelIds.length}`);

  // 3) Delete variants (2018 + models in this collection)
  const deleteVariantsResult = await prisma.variant.deleteMany({
    where: {
      year: TARGET_YEAR,
      model: {
        collectionId: collection.id,
      },
    },
  });
  console.log(`Deleted variants: ${deleteVariantsResult.count}`);

  // 4) Delete images related to 2018 Pop Culture
  const deleteImagesResult = await prisma.image.deleteMany({
    where: {
      OR: [
        // Images stored under the 2018 pop-culture path
        {
          path: {
            startsWith: '/images/hotwheels/2018/pop-culture/',
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

  // 5) Delete sub-series
  const deleteSubSeriesResult = await prisma.subSeries.deleteMany({
    where: {
      collectionId: collection.id,
    },
  });
  console.log(`Deleted sub-series: ${deleteSubSeriesResult.count}`);

  // 6) Delete models themselves (after variants/images are gone)
  const deleteModelsResult = await prisma.model.deleteMany({
    where: {
      id: { in: modelIds },
    },
  });
  console.log(`Deleted models: ${deleteModelsResult.count}`);

  // 7) Delete collection
  const deleteCollectionResult = await prisma.collection.delete({
    where: {
      id: collection.id,
    },
  });
  console.log(`Deleted collection: ${deleteCollectionResult.name}`);

  // 8) Filesystem cleanup for 2018 pop-culture images
  const popCultureDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'pop-culture');
  console.log(`\nChecking filesystem folder: ${popCultureDir}`);

  if (fs.existsSync(popCultureDir)) {
    console.log('Folder exists. Removing recursively...');
    await fs.promises.rm(popCultureDir, { recursive: true, force: true });
    console.log('Folder removed.');
  } else {
    console.log('Folder does not exist. Skipping filesystem removal.');
  }

  // 9) Verification
  console.log('\n=== Verification ===');

  const remainingVariants = await prisma.variant.count({
    where: {
      year: TARGET_YEAR,
      model: {
        collection: {
          name: COLLECTION_NAME,
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
        startsWith: '/images/hotwheels/2018/pop-culture/',
      },
    },
  });

  const popCultureDirPath = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2018', 'pop-culture');
  const folderExistsAfter = fs.existsSync(popCultureDirPath);

  console.log(`Remaining variants for 2018 Pop Culture: ${remainingVariants}`);
  console.log(`Remaining images under /images/hotwheels/2018/pop-culture/: ${remainingImages}`);
  console.log(`Filesystem folder exists after delete: ${folderExistsAfter}`);

  console.log('\n=== Summary ===');
  console.log(`Collection: ${COLLECTION_NAME} (${TARGET_YEAR})`);
  console.log(`Sub-series deleted: ${deleteSubSeriesResult.count}`);
  console.log(`Models deleted: ${deleteModelsResult.count}`);
  console.log(`Variants deleted: ${deleteVariantsResult.count}`);
  console.log(`Images deleted: ${deleteImagesResult.count}`);

  if (remainingVariants === 0 && remainingImages === 0 && !folderExistsAfter) {
    console.log('\n✅ 2018 Pop Culture data and images successfully removed.');
  } else {
    console.log('\n⚠ Some 2018 Pop Culture data or images may still remain. Please review the logs.');
  }
}

delete2018PopCulture()
  .catch((err) => {
    console.error('❌ Error while deleting 2018 Pop Culture:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




