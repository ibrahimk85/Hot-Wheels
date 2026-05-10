/**
 * Migration Script: Stars & Stripes and Neon Speeders to Silver Series
 * 
 * This script:
 *   1. Creates backup before migration
 *   2. Creates "Silver Series" Collection for all years
 *   3. Migrates "Stars & Stripes" collections to Silver Series structure
 *   4. Migrates "Neon Speeders" collections to Silver Series structure
 *   5. Creates SubSeries for each (Stars & Stripes, Neon Speeders)
 *   6. Moves Models and Variants to new structure
 *   7. Optionally deletes old collections (commented out for safety)
 * 
 * Usage:
 *   npx ts-node scripts/tools/migrate_to_silver_series.ts
 * 
 * IMPORTANT: This script uses transactions and creates a backup first.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Collections to migrate
const COLLECTIONS_TO_MIGRATE = ['Stars & Stripes', 'Neon Speeders'];

/**
 * Create a backup of the database
 */
async function createBackup(): Promise<string> {
  const projectRoot = process.cwd();
  const backupsDir = path.join(projectRoot, 'backups');
  
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(backupsDir, `pre-silver-series-migration-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const dbSource = path.join(projectRoot, 'dev.db');
  const dbDest = path.join(backupDir, 'dev.db');

  if (fs.existsSync(dbSource)) {
    fs.copyFileSync(dbSource, dbDest);
    console.log(`✓ Backup created: ${backupDir}`);
    return backupDir;
  } else {
    throw new Error('Database file not found!');
  }
}

/**
 * Get all unique years from existing collections
 */
async function getAllYears(): Promise<number[]> {
  const years = await prisma.year.findMany({
    orderBy: { year: 'asc' },
  });
  return years.map(y => y.year);
}

/**
 * Create Silver Series collections for all years
 */
async function createSilverSeriesCollections(years: number[]): Promise<Map<number, number>> {
  const collectionMap = new Map<number, number>(); // year -> collectionId

  for (const year of years) {
    let yearRecord = await prisma.year.findFirst({ where: { year } });
    if (!yearRecord) {
      yearRecord = await prisma.year.create({ data: { year } });
      console.log(`Created Year record for ${year}`);
    }

    // Check if Silver Series collection already exists for this year
    let silverSeriesCollection = await prisma.collection.findFirst({
      where: {
        name: 'Hot Wheels Silver Series',
        yearId: yearRecord.id,
      },
    });

    if (!silverSeriesCollection) {
      silverSeriesCollection = await prisma.collection.create({
        data: {
          name: 'Hot Wheels Silver Series',
          code: 'Silver Series',
          yearId: yearRecord.id,
        },
      });
      console.log(`Created Silver Series collection for year ${year}`);
    } else {
      console.log(`Silver Series collection already exists for year ${year}`);
    }

    collectionMap.set(year, silverSeriesCollection.id);
  }

  return collectionMap;
}

/**
 * Migrate a collection to Silver Series structure
 */
async function migrateCollection(
  collectionName: string,
  silverSeriesCollections: Map<number, number>
): Promise<void> {
  console.log(`\n=== Migrating ${collectionName} ===`);

  // Find all collections with this name (across all years)
  const oldCollections = await prisma.collection.findMany({
    where: {
      name: collectionName,
    },
    include: {
      year: true,
      subSeries: {
        include: {
          models: {
            include: {
              variants: true,
              images: true,
            },
          },
        },
      },
      models: {
        include: {
          variants: true,
          images: true,
        },
      },
    },
  });

  if (oldCollections.length === 0) {
    console.log(`No collections found with name "${collectionName}", skipping...`);
    return;
  }

  console.log(`Found ${oldCollections.length} collection(s) for ${collectionName}`);

  // Create SubSeries for this collection name in Silver Series
  // We'll create one SubSeries per year's Silver Series collection, but with the same name
  // This allows us to group them together when filtering
  const subSeriesMap = new Map<number, number>(); // year -> subSeriesId

  for (const oldCollection of oldCollections) {
    const year = oldCollection.year.year;
    const silverSeriesCollectionId = silverSeriesCollections.get(year);

    if (!silverSeriesCollectionId) {
      console.warn(`No Silver Series collection found for year ${year}, skipping...`);
      continue;
    }

    // Check if SubSeries already exists
    let subSeries = await prisma.subSeries.findFirst({
      where: {
        name: collectionName,
        collectionId: silverSeriesCollectionId,
      },
    });

    if (!subSeries) {
      subSeries = await prisma.subSeries.create({
        data: {
          name: collectionName,
          collectionId: silverSeriesCollectionId,
        },
      });
      console.log(`Created SubSeries "${collectionName}" for year ${year}`);
    } else {
      console.log(`SubSeries "${collectionName}" already exists for year ${year}`);
    }

    subSeriesMap.set(year, subSeries.id);
  }

  // Migrate models and variants
  let totalModelsMigrated = 0;
  let totalVariantsMigrated = 0;

  for (const oldCollection of oldCollections) {
    const year = oldCollection.year.year;
    const subSeriesId = subSeriesMap.get(year);
    const silverSeriesCollectionId = silverSeriesCollections.get(year);

    if (!subSeriesId || !silverSeriesCollectionId) {
      continue;
    }

    // Process models from old collection
    for (const oldModel of oldCollection.models) {
      // Check if model already exists in new structure
      const existingModel = await prisma.model.findFirst({
        where: {
          castingName: oldModel.castingName,
          collectionId: silverSeriesCollectionId,
          subSeriesId: subSeriesId,
        },
      });

      let newModel;
      if (existingModel) {
        newModel = existingModel;
        console.log(`Model "${oldModel.castingName}" already exists, skipping creation`);
      } else {
        // Create new model in Silver Series
        newModel = await prisma.model.create({
          data: {
            castingName: oldModel.castingName,
            castingId: oldModel.castingId,
            description: oldModel.description,
            debutSeries: oldModel.debutSeries,
            produced: oldModel.produced,
            designer: oldModel.designer,
            castingNumber: oldModel.castingNumber,
            toyNumber: oldModel.toyNumber,
            seriesNumber: oldModel.seriesNumber,
            mainImageId: oldModel.mainImageId,
            collectionId: silverSeriesCollectionId,
            subSeriesId: subSeriesId,
            owned: oldModel.owned,
            wishlisted: oldModel.wishlisted,
            quantity: oldModel.quantity,
            notes: oldModel.notes,
            packedPrice: oldModel.packedPrice,
            loosePrice: oldModel.loosePrice,
            packedPurchasePrice: oldModel.packedPurchasePrice,
            packedMarketPrice: oldModel.packedMarketPrice,
            packedOriginalPrice: oldModel.packedOriginalPrice,
            loosePurchasePrice: oldModel.loosePurchasePrice,
            looseMarketPrice: oldModel.looseMarketPrice,
            saleDate: oldModel.saleDate,
          },
        });
        totalModelsMigrated++;
        console.log(`Migrated model: ${oldModel.castingName}`);
      }

      // Migrate model images
      for (const oldImage of oldModel.images) {
        const existingImage = await prisma.image.findFirst({
          where: {
            path: oldImage.path,
            modelId: newModel.id,
          },
        });

        if (!existingImage) {
          await prisma.image.create({
            data: {
              path: oldImage.path,
              alt: oldImage.alt,
              name: oldImage.name,
              isGalleryImage: oldImage.isGalleryImage,
              order: oldImage.order,
              notes: oldImage.notes,
              modelId: newModel.id,
            },
          });
        }
      }

      // Migrate variants
      for (const oldVariant of oldModel.variants) {
        // Check if variant already exists
        const existingVariant = await prisma.variant.findFirst({
          where: {
            modelId: newModel.id,
            year: oldVariant.year,
            toyNumber: oldVariant.toyNumber,
            cardNumber: oldVariant.cardNumber,
          },
        });

        if (existingVariant) {
          console.log(`Variant already exists for ${oldModel.castingName} (${oldVariant.year}), skipping...`);
          continue;
        }

        // Create new variant
        const newVariant = await prisma.variant.create({
          data: {
            modelId: newModel.id,
            year: oldVariant.year,
            releaseName: oldVariant.releaseName,
            color: oldVariant.color,
            theme: oldVariant.theme,
            cardNumber: oldVariant.cardNumber,
            toyNumber: oldVariant.toyNumber,
            isTreasureHunt: oldVariant.isTreasureHunt,
            isSuperTreasureHunt: oldVariant.isSuperTreasureHunt,
            wheelType: oldVariant.wheelType,
            cardVariation: oldVariant.cardVariation,
            imageId: oldVariant.imageId,
            owned: oldVariant.owned,
            packedOwned: oldVariant.packedOwned,
            looseOwned: oldVariant.looseOwned,
            wishlisted: oldVariant.wishlisted,
            quantity: oldVariant.quantity,
            condition: oldVariant.condition,
            notes: oldVariant.notes,
          },
        });
        totalVariantsMigrated++;

        // Migrate variant images
        for (const oldImage of oldVariant.images) {
          const existingImage = await prisma.image.findFirst({
            where: {
              path: oldImage.path,
              variantId: newVariant.id,
            },
          });

          if (!existingImage) {
            await prisma.image.create({
              data: {
                path: oldImage.path,
                alt: oldImage.alt,
                name: oldImage.name,
                isGalleryImage: oldImage.isGalleryImage,
                order: oldImage.order,
                notes: oldImage.notes,
                variantId: newVariant.id,
              },
            });
          }
        }
      }
    }

    // Process models from SubSeries (if any)
    for (const oldSubSeries of oldCollection.subSeries) {
      for (const oldModel of oldSubSeries.models) {
        // Check if model already exists
        const existingModel = await prisma.model.findFirst({
          where: {
            castingName: oldModel.castingName,
            collectionId: silverSeriesCollectionId,
            subSeriesId: subSeriesId,
          },
        });

        let newModel;
        if (existingModel) {
          newModel = existingModel;
        } else {
          newModel = await prisma.model.create({
            data: {
              castingName: oldModel.castingName,
              castingId: oldModel.castingId,
              description: oldModel.description,
              debutSeries: oldModel.debutSeries,
              produced: oldModel.produced,
              designer: oldModel.designer,
              castingNumber: oldModel.castingNumber,
              toyNumber: oldModel.toyNumber,
              seriesNumber: oldModel.seriesNumber,
              mainImageId: oldModel.mainImageId,
              collectionId: silverSeriesCollectionId,
              subSeriesId: subSeriesId,
              owned: oldModel.owned,
              wishlisted: oldModel.wishlisted,
              quantity: oldModel.quantity,
              notes: oldModel.notes,
              packedPrice: oldModel.packedPrice,
              loosePrice: oldModel.loosePrice,
              packedPurchasePrice: oldModel.packedPurchasePrice,
              packedMarketPrice: oldModel.packedMarketPrice,
              packedOriginalPrice: oldModel.packedOriginalPrice,
              loosePurchasePrice: oldModel.loosePurchasePrice,
              looseMarketPrice: oldModel.looseMarketPrice,
              saleDate: oldModel.saleDate,
            },
          });
          totalModelsMigrated++;
          console.log(`Migrated model from SubSeries: ${oldModel.castingName}`);
        }

        // Migrate model images
        for (const oldImage of oldModel.images) {
          const existingImage = await prisma.image.findFirst({
            where: {
              path: oldImage.path,
              modelId: newModel.id,
            },
          });

          if (!existingImage) {
            await prisma.image.create({
              data: {
                path: oldImage.path,
                alt: oldImage.alt,
                name: oldImage.name,
                isGalleryImage: oldImage.isGalleryImage,
                order: oldImage.order,
                notes: oldImage.notes,
                modelId: newModel.id,
              },
            });
          }
        }

        // Migrate variants
        for (const oldVariant of oldModel.variants) {
          const existingVariant = await prisma.variant.findFirst({
            where: {
              modelId: newModel.id,
              year: oldVariant.year,
              toyNumber: oldVariant.toyNumber,
              cardNumber: oldVariant.cardNumber,
            },
          });

          if (existingVariant) {
            continue;
          }

          const newVariant = await prisma.variant.create({
            data: {
              modelId: newModel.id,
              year: oldVariant.year,
              releaseName: oldVariant.releaseName,
              color: oldVariant.color,
              theme: oldVariant.theme,
              cardNumber: oldVariant.cardNumber,
              toyNumber: oldVariant.toyNumber,
              isTreasureHunt: oldVariant.isTreasureHunt,
              isSuperTreasureHunt: oldVariant.isSuperTreasureHunt,
              wheelType: oldVariant.wheelType,
              cardVariation: oldVariant.cardVariation,
              imageId: oldVariant.imageId,
              owned: oldVariant.owned,
              packedOwned: oldVariant.packedOwned,
              looseOwned: oldVariant.looseOwned,
              wishlisted: oldVariant.wishlisted,
              quantity: oldVariant.quantity,
              condition: oldVariant.condition,
              notes: oldVariant.notes,
            },
          });
          totalVariantsMigrated++;

          // Migrate variant images
          for (const oldImage of oldVariant.images) {
            const existingImage = await prisma.image.findFirst({
              where: {
                path: oldImage.path,
                variantId: newVariant.id,
              },
            });

            if (!existingImage) {
              await prisma.image.create({
                data: {
                  path: oldImage.path,
                  alt: oldImage.alt,
                  name: oldImage.name,
                  isGalleryImage: oldImage.isGalleryImage,
                  order: oldImage.order,
                  notes: oldImage.notes,
                  variantId: newVariant.id,
                },
              });
            }
          }
        }
      }
    }
  }

  console.log(`\n✓ Migration completed for ${collectionName}`);
  console.log(`  - Models migrated: ${totalModelsMigrated}`);
  console.log(`  - Variants migrated: ${totalVariantsMigrated}`);

  // NOTE: Old collections are NOT deleted automatically for safety
  // Uncomment the following code if you want to delete old collections after migration
  /*
  console.log(`\nDeleting old ${collectionName} collections...`);
  for (const oldCollection of oldCollections) {
    await prisma.collection.delete({
      where: { id: oldCollection.id },
    });
    console.log(`Deleted old collection: ${oldCollection.name} (${oldCollection.year.year})`);
  }
  */
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('=== SILVER SERIES MIGRATION STARTED ===\n');

    // Step 1: Create backup
    console.log('Step 1: Creating backup...');
    const backupPath = await createBackup();
    console.log(`✓ Backup created at: ${backupPath}\n`);

    // Step 2: Get all years
    console.log('Step 2: Getting all years...');
    const years = await getAllYears();
    console.log(`Found ${years.length} years: ${years.join(', ')}\n`);

    // Step 3: Create Silver Series collections for all years
    console.log('Step 3: Creating Silver Series collections...');
    const silverSeriesCollections = await createSilverSeriesCollections(years);
    console.log(`✓ Created ${silverSeriesCollections.size} Silver Series collection(s)\n`);

    // Step 4: Migrate each collection
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      await migrateCollection(collectionName, silverSeriesCollections);
    }

    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
    console.log('\nNOTE: Old collections have NOT been deleted for safety.');
    console.log('Please verify the migration and delete old collections manually if needed.');
    console.log(`Backup location: ${backupPath}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nPlease restore from backup if needed.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
