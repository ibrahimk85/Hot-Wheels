/**
 * Delete specific Boulevard 2024 models by ID
 * Usage: npx ts-node scripts/tools/delete_boulevard_models.ts [modelId1] [modelId2] ...
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { deleteModel } from '../../src/features/models/model.service';

const prisma = new PrismaClient();

async function deleteModels(modelIds: number[]) {
  console.log(`\n${modelIds.length} model silinecek...\n`);

  for (const modelId of modelIds) {
    try {
      // Verify it's a Boulevard 2024 model
      const model = await prisma.model.findUnique({
        where: { id: modelId },
        include: {
          collection: {
            include: {
              year: true,
            },
          },
        },
      });

      if (!model) {
        console.log(`❌ Model ID ${modelId} bulunamadı.`);
        continue;
      }

      if (model.collection.name !== 'Boulevard' || model.collection.year.year !== 2024) {
        console.log(`❌ Model ID ${modelId} (${model.castingName}) Boulevard 2024 değil, atlanıyor.`);
        continue;
      }

      console.log(`🗑️  Siliniyor: ID ${modelId} - ${model.castingName}`);
      await deleteModel(modelId);
      console.log(`✅ Model ID ${modelId} başarıyla silindi.\n`);
    } catch (error) {
      console.error(`❌ Model ID ${modelId} silinirken hata:`, error);
    }
  }

  await prisma.$disconnect();
  console.log('\n✅ İşlem tamamlandı.');
}

// Get model IDs from command line arguments
const modelIds = process.argv.slice(2).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

if (modelIds.length === 0) {
  console.log('Kullanım: npx ts-node scripts/tools/delete_boulevard_models.ts [modelId1] [modelId2] ...');
  process.exit(1);
}

deleteModels(modelIds).catch((error) => {
  console.error('Hata:', error);
  process.exit(1);
});


