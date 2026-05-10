import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const PRESERVE_YEAR = 2025;
const MAINLINE_NAME = 'Mainline';

async function verifyDeletion() {
  console.log('=== Verification: Non-2025 Mainline Data Deletion ===\n');

  // Check remaining years (excluding 2025)
  const non2025Years = await prisma.year.findMany({
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
          _count: {
            select: {
              models: true,
            },
          },
        },
      },
    },
  });

  console.log(`Years found (excluding ${PRESERVE_YEAR}): ${non2025Years.length}`);
  const yearsWithMainline = non2025Years.filter((y) => y.collections.length > 0);
  console.log(`Years with Mainline collections: ${yearsWithMainline.length}`);

  if (yearsWithMainline.length > 0) {
    console.log('\n⚠️  WARNING: Found years with Mainline collections:');
    yearsWithMainline.forEach((y) => {
      y.collections.forEach((c) => {
        console.log(`  - Year ${y.year}: Mainline collection with ${c._count.models} models`);
      });
    });
  } else {
    console.log('✅ No Mainline collections found for non-2025 years');
  }

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
  console.log(`\nRemaining variants for non-${PRESERVE_YEAR} Mainline: ${remainingVariants}`);
  if (remainingVariants > 0) {
    console.log('⚠️  WARNING: Variants still exist');
  } else {
    console.log('✅ No variants found for non-2025 Mainline');
  }

  // Check remaining images
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
  if (remainingImages > 0) {
    console.log('⚠️  WARNING: Images still exist');
  } else {
    console.log('✅ No images found for non-2025 Mainline');
  }

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
  console.log(`\nRemaining mainline image folders (excluding ${PRESERVE_YEAR}): ${remainingFolders.length}`);
  if (remainingFolders.length > 0) {
    console.log('⚠️  WARNING: Image folders still exist:');
    remainingFolders.forEach((folder) => {
      console.log(`  - ${folder}`);
    });
  } else {
    console.log('✅ No image folders found for non-2025 Mainline');
  }

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
          _count: {
            select: {
              models: true,
            },
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

      console.log(`2025 Mainline Collection: ${mainline2025._count.models} models`);
      console.log(`2025 Mainline Variants: ${variants2025}`);
      console.log(`2025 Mainline Images: ${images2025}`);
      console.log(`2025 Mainline Folder exists: ${folder2025Exists}`);

      if (mainline2025._count.models > 0 && variants2025 > 0) {
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

  // Final summary
  console.log('\n=== Final Summary ===');
  const allGood =
    yearsWithMainline.length === 0 &&
    remainingVariants === 0 &&
    remainingImages === 0 &&
    remainingFolders.length === 0;

  if (allGood) {
    console.log('✅ All non-2025 Mainline data and images have been successfully removed.');
  } else {
    console.log('⚠️  Some non-2025 Mainline data or images may still remain.');
  }

  await prisma.$disconnect();
}

verifyDeletion().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});










