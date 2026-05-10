import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing 2019 Mainline Toy# matching...\n');
  
  // Find 2019 Mainline collection
  const mainlineCollection = await prisma.collection.findFirst({
    where: {
      name: 'Mainline',
      year: {
        year: 2019,
      },
    },
  });

  if (!mainlineCollection) {
    console.log('2019 Mainline collection not found.');
    return;
  }

  // Get all variants for 2019 Mainline
  const variants = await prisma.variant.findMany({
    where: {
      year: 2019,
      model: {
        collectionId: mainlineCollection.id,
      },
    },
    include: {
      model: {
        select: {
          castingName: true,
        },
      },
      images: true,
    },
    orderBy: [
      { cardNumber: 'asc' },
      { toyNumber: 'asc' },
    ],
  });

  console.log(`Total variants: ${variants.length}\n`);

  // Check for variants without Toy#
  const variantsWithoutToyNumber = variants.filter(v => !v.toyNumber);
  if (variantsWithoutToyNumber.length > 0) {
    console.log(`⚠️  Variants WITHOUT Toy#: ${variantsWithoutToyNumber.length}`);
    variantsWithoutToyNumber.forEach(v => {
      console.log(`  - ${v.model.castingName} (Card #${v.cardNumber}, Color: ${v.color || 'N/A'})`);
    });
    console.log('');
  }

  // Check for variants without images
  const variantsWithoutImages = variants.filter(v => !v.imageId && v.images.length === 0);
  if (variantsWithoutImages.length > 0) {
    console.log(`⚠️  Variants WITHOUT images: ${variantsWithoutImages.length}`);
    variantsWithoutImages.forEach(v => {
      console.log(`  - ${v.model.castingName} (Card #${v.cardNumber}, Toy#: ${v.toyNumber || 'N/A'}, Color: ${v.color || 'N/A'})`);
    });
    console.log('');
  }

  // Group variants by cardNumber to check for 2nd/3rd color variants
  const variantsByCardNumber = new Map<string, typeof variants>();
  variants.forEach(v => {
    if (v.cardNumber) {
      if (!variantsByCardNumber.has(v.cardNumber)) {
        variantsByCardNumber.set(v.cardNumber, []);
      }
      variantsByCardNumber.get(v.cardNumber)!.push(v);
    }
  });

  // Check for models with multiple variants (2nd/3rd color)
  const modelsWithMultipleVariants: Array<{
    cardNumber: string;
    castingName: string;
    variants: typeof variants;
  }> = [];

  variantsByCardNumber.forEach((variantList, cardNumber) => {
    if (variantList.length > 1) {
      modelsWithMultipleVariants.push({
        cardNumber,
        castingName: variantList[0].model.castingName,
        variants: variantList,
      });
    }
  });

  console.log(`📊 Models with multiple variants (2nd/3rd color): ${modelsWithMultipleVariants.length}\n`);

  // Check if all variants have Toy# and images
  let issuesFound = 0;
  modelsWithMultipleVariants.forEach(({ cardNumber, castingName, variants: variantList }) => {
    const missingToyNumber = variantList.filter(v => !v.toyNumber);
    const missingImages = variantList.filter(v => !v.imageId && v.images.length === 0);
    
    if (missingToyNumber.length > 0 || missingImages.length > 0) {
      issuesFound++;
      console.log(`❌ ${castingName} (Card #${cardNumber}):`);
      variantList.forEach(v => {
        const toyStatus = v.toyNumber ? `✓ Toy#: ${v.toyNumber}` : '✗ Missing Toy#';
        const imageStatus = (v.imageId || v.images.length > 0) ? '✓ Has image' : '✗ Missing image';
        console.log(`   - Color: ${v.color || 'N/A'}, ${toyStatus}, ${imageStatus}`);
      });
      console.log('');
    }
  });

  if (issuesFound === 0) {
    console.log('✅ All variants with multiple colors have Toy# and images!\n');
  } else {
    console.log(`\n⚠️  Found issues in ${issuesFound} models with multiple variants.\n`);
  }

  // Summary
  console.log('📈 Summary:');
  console.log(`  Total variants: ${variants.length}`);
  console.log(`  Variants without Toy#: ${variantsWithoutToyNumber.length}`);
  console.log(`  Variants without images: ${variantsWithoutImages.length}`);
  console.log(`  Models with multiple variants: ${modelsWithMultipleVariants.length}`);
  console.log(`  Models with issues: ${issuesFound}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });















