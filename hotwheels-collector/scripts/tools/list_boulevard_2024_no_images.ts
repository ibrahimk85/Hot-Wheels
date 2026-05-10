/**
 * List Boulevard 2024 models without images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function listModelsWithoutImages() {
  try {
    const models = await prisma.model.findMany({
      where: {
        collection: {
          name: 'Boulevard',
          year: {
            year: 2024,
          },
        },
      },
      include: {
        variants: {
          include: {
            images: true,
          },
        },
        images: true,
        subSeries: true,
      },
      orderBy: {
        castingName: 'asc',
      },
    });

    const modelsWithoutImages = models.filter((model) => {
      const hasModelImage = model.images && model.images.length > 0;
      const hasVariantImage = model.variants.some(
        (variant) => variant.images && variant.images.length > 0
      );
      return !hasModelImage && !hasVariantImage;
    });

    let output = `\n============================================================\n`;
    output += `Boulevard 2024 - Görseli Olmayan Modeller\n`;
    output += `============================================================\n\n`;
    output += `Toplam Model Sayısı: ${models.length}\n`;
    output += `Görseli Olmayan Model Sayısı: ${modelsWithoutImages.length}\n\n`;

    if (modelsWithoutImages.length === 0) {
      output += 'Görseli olmayan model bulunamadı.\n';
    } else {
      modelsWithoutImages.forEach((model, index) => {
        output += `${index + 1}. Model ID: ${model.id}\n`;
        output += `   İsim: ${model.castingName}\n`;
        output += `   Alt Seri: ${model.subSeries?.name || 'N/A'}\n`;
        output += `   Varyant Sayısı: ${model.variants.length}\n`;
        if (model.variants.length > 0) {
          output += `   Varyantlar:\n`;
          model.variants.forEach((v) => {
            output += `     - Variant ID: ${v.id}, Yıl: ${v.year}, Series#: ${v.cardNumber || 'N/A'}\n`;
          });
        }
        output += `\n`;
      });
      output += `\n============================================================\n`;
      output += `TOPLAM: ${modelsWithoutImages.length} görseli olmayan model bulundu.\n`;
      output += `============================================================\n`;
    }

    // Console'a yazdır
    process.stdout.write(output);
    
    // Dosyaya da yazdır
    const outputPath = './boulevard_2024_no_images.txt';
    fs.writeFileSync(outputPath, output, 'utf8');
    process.stdout.write('\nSonuçlar "boulevard_2024_no_images.txt" dosyasına da kaydedildi.\n');

    // JSON olarak da kaydet
    const jsonData = {
      totalModels: models.length,
      modelsWithoutImages: modelsWithoutImages.length,
      models: modelsWithoutImages.map(m => ({
        id: m.id,
        castingName: m.castingName,
        subSeries: m.subSeries?.name || null,
        variantCount: m.variants.length,
        variants: m.variants.map(v => ({
          id: v.id,
          year: v.year,
          cardNumber: v.cardNumber,
        })),
      })),
    };
    fs.writeFileSync('./boulevard_2024_no_images.json', JSON.stringify(jsonData, null, 2), 'utf8');

    await prisma.$disconnect();
  } catch (error) {
    console.error('Hata:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listModelsWithoutImages();


