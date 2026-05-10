import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      year: 2021,
      cardNumber: '33',
      model: {
        collection: {
          name: 'Team Transport',
        },
      },
    },
    include: {
      model: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log(`\nSeries#33 Variants (${variants.length} adet):\n`);
  variants.forEach((v, idx) => {
    console.log(`${idx + 1}. ID: ${v.id}`);
    console.log(`   Release Name: ${v.releaseName}`);
    console.log(`   Model: ${v.model.castingName} (ID: ${v.modelId})`);
    console.log(`   Year: ${v.year}, Card#: ${v.cardNumber}`);
    console.log('');
  });

  // Check for duplicates
  const releaseNames = variants.map(v => v.releaseName);
  const duplicates = releaseNames.filter((name, idx) => releaseNames.indexOf(name) !== idx);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Duplicate release names found: ${duplicates.join(', ')}\n`);
    
    // Group by release name
    const grouped = new Map<string, typeof variants>();
    variants.forEach(v => {
      if (!grouped.has(v.releaseName)) {
        grouped.set(v.releaseName, []);
      }
      grouped.get(v.releaseName)!.push(v);
    });

    console.log(`\nGrouped by release name:\n`);
    for (const [name, vs] of grouped.entries()) {
      if (vs.length > 1) {
        console.log(`  "${name}" (${vs.length} adet):`);
        vs.forEach(v => console.log(`    - ID: ${v.id}, Model ID: ${v.modelId}`));
        console.log('');
      }
    }
  } else {
    console.log(`\n✅ No duplicate release names found.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
