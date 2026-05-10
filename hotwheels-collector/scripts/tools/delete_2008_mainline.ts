import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const TARGET_YEAR = 2008;
const MAINLINE_NAME = 'Mainline';

async function delete2008Mainline() {
  console.log('=== Delete 2008 Mainline Data & Images ===\n');

  const collection = await prisma.collection.findFirst({
    where: {
      name: MAINLINE_NAME,
      year: { year: TARGET_YEAR },
    },
    include: { year: true },
  });

  if (!collection) {
    console.log(
      `No collection found for year ${TARGET_YEAR} and name "${MAINLINE_NAME}". Nothing to delete.`,
    );
    return;
  }

  console.log(`Found collection: id=${collection.id}, name=${collection.name}, year=${collection.year.year}`);

  const models = await prisma.model.findMany({
    where: { collectionId: collection.id },
    select: { id: true },
  });
  const modelIds = models.map(m => m.id);
  console.log(`Models under 2008 Mainline: ${modelIds.length}`);

  const deleteVariantsResult = await prisma.variant.deleteMany({
    where: {
      year: TARGET_YEAR,
      model: { collectionId: collection.id },
    },
  });
  console.log(`Deleted variants: ${deleteVariantsResult.count}`);

  const imagePathPrefix = `/images/hotwheels/${TARGET_YEAR}/mainline/`;
  const deleteImagesResult = await prisma.image.deleteMany({
    where: {
      OR: [
        { path: { startsWith: imagePathPrefix } },
        {
          variant: {
            model: { collectionId: collection.id },
          },
        },
        {
          model: { collectionId: collection.id },
        },
      ],
    },
  });
  console.log(`Deleted images: ${deleteImagesResult.count}`);

  const deleteModelsResult = await prisma.model.deleteMany({
    where: { id: { in: modelIds } },
  });
  console.log(`Deleted models: ${deleteModelsResult.count}`);

  try {
    const subDel = await prisma.subSeries.deleteMany({
      where: { collectionId: collection.id },
    });
    console.log(`Deleted sub-series: ${subDel.count}`);
  } catch (e) {
    console.warn('Sub-series delete skipped (dependencies?):', e);
  }

  const mainlineDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', String(TARGET_YEAR), 'mainline');
  console.log(`\nChecking filesystem folder: ${mainlineDir}`);
  if (fs.existsSync(mainlineDir)) {
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
          year: { year: TARGET_YEAR },
        },
      },
    },
  });
  const remainingImages = await prisma.image.count({
    where: { path: { startsWith: imagePathPrefix } },
  });
  const folderExistsAfter = fs.existsSync(mainlineDir);

  console.log(`Remaining variants for 2008 Mainline: ${remainingVariants}`);
  console.log(`Remaining images under ${imagePathPrefix}: ${remainingImages}`);
  console.log(`Filesystem folder exists after delete: ${folderExistsAfter}`);

  console.log('\n=== Summary ===');
  console.log(`Variants deleted: ${deleteVariantsResult.count}`);
  console.log(`Images deleted: ${deleteImagesResult.count}`);
  console.log(`Models deleted: ${deleteModelsResult.count}`);

  if (remainingVariants === 0 && remainingImages === 0 && !folderExistsAfter) {
    console.log('\n✅ 2008 Mainline data and images removed.');
  } else {
    console.log('\n⚠ Some 2008 Mainline data or images may still remain. Review logs.');
  }
}

(async () => {
  try {
    await delete2008Mainline();
  } catch (err) {
    console.error('❌ Error while deleting 2008 Mainline:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
