import prisma from '../src/db';

async function migrateOwnedToPackedOwned() {
  console.log('Migrating owned values to packedOwned...');
  
  // Get all variants with owned = true
  const ownedVariants = await prisma.variant.findMany({
    where: {
      owned: true,
    },
    select: {
      id: true,
      owned: true,
      packedOwned: true,
    },
  });

  console.log(`Found ${ownedVariants.length} variants with owned = true`);

  // Update packedOwned for variants where owned = true but packedOwned = false
  const variantsToUpdate = ownedVariants.filter(v => !v.packedOwned);
  console.log(`Updating ${variantsToUpdate.length} variants...`);

  if (variantsToUpdate.length > 0) {
    const result = await prisma.variant.updateMany({
      where: {
        id: {
          in: variantsToUpdate.map(v => v.id),
        },
        owned: true,
        packedOwned: false,
      },
      data: {
        packedOwned: true,
      },
    });

    console.log(`Successfully updated ${result.count} variants`);
  } else {
    console.log('No variants need updating');
  }

  // Verify the migration
  const verifyOwned = await prisma.variant.count({
    where: { owned: true },
  });
  const verifyPackedOwned = await prisma.variant.count({
    where: { packedOwned: true },
  });

  console.log(`\nVerification:`);
  console.log(`- Variants with owned = true: ${verifyOwned}`);
  console.log(`- Variants with packedOwned = true: ${verifyPackedOwned}`);

  if (verifyOwned > verifyPackedOwned) {
    console.log(`\n⚠️  WARNING: Some owned variants were not migrated!`);
    console.log(`   Difference: ${verifyOwned - verifyPackedOwned} variants`);
    
    // Find variants that are owned but not packedOwned
    const missing = await prisma.variant.findMany({
      where: {
        owned: true,
        packedOwned: false,
      },
      select: {
        id: true,
      },
    });
    
    if (missing.length > 0) {
      console.log(`\nUpdating remaining ${missing.length} variants...`);
      await prisma.variant.updateMany({
        where: {
          id: {
            in: missing.map(v => v.id),
          },
        },
        data: {
          packedOwned: true,
        },
      });
      console.log('✅ All variants migrated successfully!');
    }
  } else {
    console.log('✅ Migration verified successfully!');
  }
}

migrateOwnedToPackedOwned()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








