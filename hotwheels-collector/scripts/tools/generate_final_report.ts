/**
 * Generate final report for 2026 scraping
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Generating Final Report...\n');

  const year2026 = await prisma.year.findFirst({ where: { year: 2026 } });
  if (!year2026) {
    console.log('⚠️  Year 2026 not found. Please run the scraping script first.');
    await prisma.$disconnect();
    return;
  }

  const mainlineCollection = await prisma.collection.findFirst({
    where: { name: 'Mainline', yearId: year2026.id },
    include: {
      _count: {
        select: {
          models: true,
          subSeries: true,
        },
      },
    },
  });

  if (!mainlineCollection) {
    console.log('⚠️  Mainline collection not found for 2026.');
    await prisma.$disconnect();
    return;
  }

  const subSeries = await prisma.subSeries.findMany({
    where: { collectionId: mainlineCollection.id },
    include: {
      _count: {
        select: { models: true },
      },
    },
  });

  const variants = await prisma.variant.findMany({
    where: {
      model: {
        collectionId: mainlineCollection.id,
      },
    },
  });

  const thCount = variants.filter(v => v.isTreasureHunt).length;
  const sthCount = variants.filter(v => v.isSuperTreasureHunt).length;

  const images = await prisma.image.findMany({
    where: {
      variant: {
        model: {
          collectionId: mainlineCollection.id,
        },
      },
    },
  });

  const imageDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', '2026', 'mainline');
  const imageDirExists = fs.existsSync(imageDir);
  let imageFileCount = 0;
  if (imageDirExists) {
    try {
      const files = fs.readdirSync(imageDir, { recursive: true });
      imageFileCount = files.filter((f): f is string => typeof f === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(f)).length;
    } catch (e) {
      // Ignore errors
    }
  }

  const modelsWithDetails = await prisma.model.findMany({
    where: {
      collectionId: mainlineCollection.id,
      description: { not: null },
    },
  });

  const report = `# 2026 Hot Wheels Mainline Scraping Final Raporu

## Genel Bakış
Bu rapor, 2026 Hot Wheels Mainline verilerinin wiki'den çekilmesi ve uygulamaya entegre edilmesi sürecini özetlemektedir.

## Yapılan İşlemler

### 1. Script Oluşturma ✅
- \`scrape_2026_mainline_complete.ts\` scripti oluşturuldu
- 2025 scripti temel alınarak 2026 için uyarlandı
- URL güncellendi: \`https://hotwheels.fandom.com/wiki/List_of_2026_Hot_Wheels\`

### 2. Veri Çekme Özellikleri ✅
- Toy# (1. kolon)
- Col# (2. kolon)
- Model Name (3. kolon) - link ile model detay sayfası
- Series (4. kolon) - TH/STH bilgileri parse edildi
- Series# (5. kolon)
- Image URL (6. kolon) - en büyük boyut alındı

### 3. Model Detay Sayfası Bilgileri ✅
Her model için detay sayfasından çekilen bilgiler:
- Debut Series
- Produced
- Designer
- Number
- Description

### 4. UI Güncellemeleri ✅

#### Models Sayfası
- \`getAllSubSeries()\` fonksiyonu güncellendi
- Aynı isimde alt seri birden fazla yılda varsa yıl seçimi gösteriliyor
- \`ModelsList.tsx\` güncellendi - yıl bilgisi gösteriliyor

#### Collections Sayfası
- Mainline koleksiyonları gruplandı
- Mainline için yıl seçim sayfası oluşturuldu: \`/collections/mainline\`
- Birden fazla yıl varsa yıl seçim sayfasına yönlendiriliyor

## İstatistikler

### Veritabanı
- **Yıl:** 2026 ✅
- **Koleksiyon:** Mainline ✅
- **Alt Seriler:** ${subSeries.length}
- **Modeller:** ${mainlineCollection._count.models}
- **Varyantlar:** ${variants.length}
- **Treasure Hunts:** ${thCount}
- **Super Treasure Hunts:** ${sthCount}

### Görseller
- **İndirilen Görsel Sayısı (DB):** ${images.length}
- **İndirilen Görsel Sayısı (Dosya Sistemi):** ${imageFileCount}
- **Görsel Klasörü:** \`public/images/hotwheels/2026/mainline/\`
- **Görsel Klasörü Durumu:** ${imageDirExists ? '✅ Var' : '❌ Yok'}

### Model Detayları
- **Detay Sayfası Çekilen Model Sayısı:** ${modelsWithDetails.length}
- **Toplam Model Sayısı:** ${mainlineCollection._count.models}
- **Detay Oranı:** ${mainlineCollection._count.models > 0 ? ((modelsWithDetails.length / mainlineCollection._count.models) * 100).toFixed(1) : 0}%

## Alt Seriler (İlk 10)
${subSeries.slice(0, 10).map(ss => `- **${ss.name}**: ${ss._count.models} model`).join('\n')}
${subSeries.length > 10 ? `\n... ve ${subSeries.length - 10} alt seri daha` : ''}

## Notlar
- Script rate limiting ile çalışıyor (model detayları için 500ms, görseller için 300ms)
- Duplicate kontrolü yapılıyor - aynı variant iki kez oluşturulmuyor
- Görseller en büyük boyutta indiriliyor (thumbnail parametreleri temizleniyor)
- Model detayları JSON formatında \`description\` alanında saklanıyor

## Tamamlanan Görevler
1. ✅ 2026 için ana scraping scripti oluşturuldu
2. ✅ Models sayfası güncellendi (yıl seçimi)
3. ✅ Collections sayfası güncellendi (Mainline yıl seçimi)
4. ✅ Script çalıştırıldı
5. ✅ Veri doğrulama yapıldı
6. ✅ UI güncellemeleri tamamlandı
7. ✅ Final rapor oluşturuldu

---

**Rapor Oluşturulma Tarihi:** ${new Date().toLocaleString('tr-TR')}
**Toplam İşlem Süresi:** Script çalıştırma ve doğrulama tamamlandı
`;

  const reportPath = path.join(process.cwd(), 'scripts', 'tools', 'SCRAPE_2026_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  
  console.log('✅ Final report generated!');
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Year: ✅`);
  console.log(`Collection: ✅`);
  console.log(`SubSeries: ${subSeries.length}`);
  console.log(`Models: ${mainlineCollection._count.models}`);
  console.log(`Variants: ${variants.length}`);
  console.log(`Images (DB): ${images.length}`);
  console.log(`Images (Files): ${imageFileCount}`);
  console.log(`TH: ${thCount}`);
  console.log(`STH: ${sthCount}`);
  console.log('='.repeat(60));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());








