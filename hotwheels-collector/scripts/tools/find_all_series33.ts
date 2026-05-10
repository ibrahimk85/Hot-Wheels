import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find ALL variants with cardNumber 33 in 2021 Team Transport
  const allVariants = await prisma.variant.findMany({
    where: {
      year: 2021,
      cardNumber: '33',
    },
    include: {
      model: {
        include: {
          collection: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log(`\nTÜM Series#33 Variant'ları (${allVariants.length} adet):\n`);
  
  const teamTransportVariants = allVariants.filter(v => 
    v.model.collection.name === 'Team Transport'
  );
  
  const otherVariants = allVariants.filter(v => 
    v.model.collection.name !== 'Team Transport'
  );

  console.log(`Team Transport: ${teamTransportVariants.length} adet\n`);
  teamTransportVariants.forEach((v, idx) => {
    console.log(`${idx + 1}. ID: ${v.id}`);
    console.log(`   Release Name: ${v.releaseName}`);
    console.log(`   Model: ${v.model.castingName} (ID: ${v.modelId})`);
    console.log(`   Collection: ${v.model.collection.name}`);
    console.log(`   Created: ${v.id} (lower ID = older)`);
    console.log('');
  });

  if (otherVariants.length > 0) {
    console.log(`\nDiğer Koleksiyonlar: ${otherVariants.length} adet\n`);
    otherVariants.forEach((v, idx) => {
      console.log(`${idx + 1}. ID: ${v.id}`);
      console.log(`   Release Name: ${v.releaseName}`);
      console.log(`   Model: ${v.model.castingName}`);
      console.log(`   Collection: ${v.model.collection.name}`);
      console.log('');
    });
  }

  // Check for exact duplicates (same model, same cardNumber, same year, same releaseName)
  const seen = new Map<string, number[]>();
  teamTransportVariants.forEach(v => {
    const key = `${v.modelId}_${v.cardNumber}_${v.year}_${v.releaseName}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(v.id);
  });

  const duplicates: Array<{ key: string; ids: number[] }> = [];
  for (const [key, ids] of seen.entries()) {
    if (ids.length > 1) {
      duplicates.push({ key, ids });
    }
  }

  if (duplicates.length > 0) {
    console.log(`\n⚠️  DUPLICATE VARIANT'LAR BULUNDU:\n`);
    duplicates.forEach(({ key, ids }) => {
      console.log(`  Key: ${key}`);
      console.log(`  Duplicate IDs: ${ids.join(', ')}`);
      console.log(`  (En eski ID'yi tutup diğerlerini sileceğiz)\n`);
    });
  } else {
    console.log(`\n✅ Exact duplicate yok.`);
    
    // Check for similar release names
    const releaseNames = teamTransportVariants.map(v => v.releaseName);
    const similar: string[] = [];
    for (let i = 0; i < releaseNames.length; i++) {
      for (let j = i + 1; j < releaseNames.length; j++) {
        if (releaseNames[i] === releaseNames[j]) {
          similar.push(releaseNames[i]);
        }
      }
    }
    
    if (similar.length > 0) {
      console.log(`\n⚠️  Aynı release name'e sahip variant'lar:\n`);
      similar.forEach(name => {
        const vs = teamTransportVariants.filter(v => v.releaseName === name);
        console.log(`  "${name}": ${vs.length} adet (IDs: ${vs.map(v => v.id).join(', ')})`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
