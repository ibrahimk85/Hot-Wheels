/**
 * Script to check for duplicates by Toy# (castingId) for 2021 Mainline normal variants
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('=== Checking Duplicates by Toy# for 2021 Mainline Normal Variants ===\n');

  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2021,
      },
    },
  });

  if (!mainlineCollection) {
    console.error('❌ 2021 Mainline collection not found!');
    return;
  }

  // Get all normal variants
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2021,
      isTreasureHunt: false,
      isSuperTreasureHunt: false,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: {
        select: {
          id: true,
          castingName: true,
          castingId: true,
        },
      },
    },
  });

  console.log(`Total normal variants: ${allVariants.length}\n`);

  // Group by castingId + cardNumber + color
  const groups = new Map<string, typeof allVariants>();
  
  for (const variant of allVariants) {
    const castingId = variant.model.castingId || 'NULL_CASTING_ID';
    const color = variant.color || 'NULL_COLOR';
    const key = `${castingId}|${variant.cardNumber}|${color}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(variant);
  }

  // Find groups with multiple variants
  const duplicates: Array<{ key: string; variants: typeof allVariants }> = [];
  for (const [key, variants] of groups.entries()) {
    if (variants.length > 1) {
      duplicates.push({ key, variants });
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found by Toy# + Card# + Color\n');
  } else {
    console.log(`⚠️  Found ${duplicates.length} duplicate groups:\n`);
    for (const { key, variants } of duplicates) {
      const [castingId, cardNumber, color] = key.split('|');
      console.log(`Toy#: ${castingId}, Card#: ${cardNumber}, Color: ${color === 'NULL_COLOR' ? 'null' : color}`);
      for (const variant of variants) {
        console.log(`  - Variant ID: ${variant.id}, Model ID: ${variant.model.id}, Model: ${variant.model.castingName}`);
      }
      console.log('');
    }
  }

  // Also check for same castingId but different modelId (same Toy# but different Model records)
  const castingIdGroups = new Map<string, typeof allVariants>();
  
  for (const variant of allVariants) {
    const castingId = variant.model.castingId;
    if (!castingId) continue;
    
    if (!castingIdGroups.has(castingId)) {
      castingIdGroups.set(castingId, []);
    }
    castingIdGroups.get(castingId)!.push(variant);
  }

  // Find castingIds that appear in multiple models
  const sameToyDifferentModel: Array<{ castingId: string; variants: typeof allVariants }> = [];
  for (const [castingId, variants] of castingIdGroups.entries()) {
    const uniqueModelIds = new Set(variants.map(v => v.model.id));
    if (uniqueModelIds.size > 1) {
      sameToyDifferentModel.push({ castingId, variants });
    }
  }

  if (sameToyDifferentModel.length > 0) {
    console.log(`\n⚠️  Found ${sameToyDifferentModel.length} Toy# that appear in multiple Model records:\n`);
    for (const { castingId, variants } of sameToyDifferentModel) {
      console.log(`Toy#: ${castingId}`);
      const modelGroups = new Map<number, typeof variants>();
      for (const variant of variants) {
        if (!modelGroups.has(variant.model.id)) {
          modelGroups.set(variant.model.id, []);
        }
        modelGroups.get(variant.model.id)!.push(variant);
      }
      for (const [modelId, modelVariants] of modelGroups.entries()) {
        const model = modelVariants[0].model;
        console.log(`  Model ID: ${modelId}, Model: ${model.castingName}, Variants: ${modelVariants.length}`);
        // Show card numbers for this model
        const cardNumbers = [...new Set(modelVariants.map(v => v.cardNumber))];
        console.log(`    Card#: ${cardNumbers.join(', ')}`);
      }
      console.log('');
    }
  } else {
    console.log('\n✅ No Toy# appear in multiple Model records\n');
  }

  // Check for variants with same cardNumber and same castingName but different modelId
  const cardNumberGroups = new Map<string, typeof allVariants>();
  
  for (const variant of allVariants) {
    const cardNumber = variant.cardNumber || 'NO_CARD';
    if (!cardNumberGroups.has(cardNumber)) {
      cardNumberGroups.set(cardNumber, []);
    }
    cardNumberGroups.get(cardNumber)!.push(variant);
  }

  const sameCardDifferentModel: Array<{ cardNumber: string; variants: typeof allVariants }> = [];
  for (const [cardNumber, variants] of cardNumberGroups.entries()) {
    if (cardNumber === 'NO_CARD') continue;
    
    // Check if same cardNumber appears with different modelId but same castingName
    const modelGroups = new Map<number, typeof variants>();
    for (const variant of variants) {
      if (!modelGroups.has(variant.model.id)) {
        modelGroups.set(variant.model.id, []);
      }
      modelGroups.get(variant.model.id)!.push(variant);
    }
    
    if (modelGroups.size > 1) {
      // Check if they have the same castingName
      const castingNames = [...new Set(variants.map(v => v.model.castingName))];
      if (castingNames.length === 1) {
        sameCardDifferentModel.push({ cardNumber, variants });
      }
    }
  }

  if (sameCardDifferentModel.length > 0) {
    console.log(`\n⚠️  Found ${sameCardDifferentModel.length} Card# that appear in multiple Model records with same castingName:\n`);
    for (const { cardNumber, variants } of sameCardDifferentModel) {
      console.log(`Card#: ${cardNumber}, Casting Name: ${variants[0].model.castingName}`);
      const modelGroups = new Map<number, typeof variants>();
      for (const variant of variants) {
        if (!modelGroups.has(variant.model.id)) {
          modelGroups.set(variant.model.id, []);
        }
        modelGroups.get(variant.model.id)!.push(variant);
      }
      for (const [modelId, modelVariants] of modelGroups.entries()) {
        const model = modelVariants[0].model;
        console.log(`  Model ID: ${modelId}, Casting ID: ${model.castingId || 'NULL'}, Variants: ${modelVariants.length}`);
        for (const variant of modelVariants) {
          console.log(`    - Variant ID: ${variant.id}, Color: ${variant.color || 'null'}, Release: ${variant.releaseName || 'N/A'}`);
        }
      }
      console.log('');
    }
  } else {
    console.log('\n✅ No Card# appear in multiple Model records with same castingName\n');
  }
}

checkDuplicates()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

















