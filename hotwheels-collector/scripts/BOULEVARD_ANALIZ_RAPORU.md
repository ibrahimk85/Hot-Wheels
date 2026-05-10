# Boulevard Serisi - Analiz Raporu

## 📋 Boulevard Serisi Planı ve Özellikleri

### Temel Bilgiler
- **Yıllar:** 2012-2026 (15 yıl)
- **Koleksiyon Adı:** "Boulevard"
- **Ana Kaynak:** https://hotwheels.fandom.com/wiki/Hot_Wheels_Boulevard
- **Yıl Bazlı Sayfalar:** `https://hotwheels.fandom.com/wiki/{YIL}_Hot_Wheels_Boulevard`

### Boulevard vs Mainline Farkları

#### 1. **Treasure Hunt (TH/STH)**
- ❌ **Boulevard:** TH/STH yok (her zaman `false`)
- ✅ **Mainline:** TH/STH var, parse ediliyor

#### 2. **Alt Seriler (SubSeries)**
- ✅ **Boulevard:** Mix1, Mix2, Mix3, Mix4 vb. (her yıl değişebilir)
- ✅ **Mainline:** A, B, C, D, E, F vb. veya başka isimler

#### 3. **Resim Yapısı**
- ✅ **Boulevard:** 
  - Photo Carded (ana resim) → `{toyNumber}_carded.jpg`
  - Photo Loose (ikinci resim) → `{toyNumber}_loose.jpg`
  - Resim yolu: `public/images/hotwheels/{year}/boulevard/{castingSlug}/`
- ✅ **Mainline:** 
  - Tek resim → `{toyNumber}.jpg`
  - Resim yolu: `public/images/hotwheels/{year}/mainline/{castingSlug}/`

#### 4. **Tablo Yapısı**
- ✅ **Boulevard:** 
  - Birden fazla tablo olabilir (her Mix için ayrı tablo)
  - Kolonlar yıllara göre değişebilir
  - Dinamik kolon tespiti gerekebilir
- ✅ **Mainline:** 
  - Genellikle tek bir büyük tablo
  - Sabit kolon yapısı (Toy#, Collector #, Casting Name, vb.)

### Veritabanı Yapısı

```
Year (2012-2026)
└── Collection (name: "Boulevard")
    └── SubSeries (Mix1, Mix2, Mix3, vb.)
        └── Model (castingName, castingId)
            └── Variant (year, cardNumber, color, isTreasureHunt: false, isSuperTreasureHunt: false)
                ├── Image (Photo Carded - ana resim)
                └── Image (Photo Loose - ikinci resim)
```

## 🔍 Boulevard Scriptlerinde Tespit Edilen Sorunlar

### 1. **TypeScript Hataları**
- ❌ `TS2351: This expression is not constructable. Type 'String' has no construct signatures.`
- **Neden:** `String()` constructor kullanımı, primitive `string` yerine `String` objesi döndürüyor
- **Etkilenen:** Tüm resim indirme scriptleri (15 dosya)

### 2. **Karmaşık Dinamik Kolon Tespiti**
- ⚠️ Her yıl için tablo yapısı değişebilir
- ⚠️ Dinamik kolon tespiti güvenilir olmayabilir
- ⚠️ Mix tespiti (table caption, header vb.) tutarsız olabilir

### 3. **Template'ten Üretme Sorunları**
- ⚠️ Template'ten yıl bazlı script oluştururken hatalar
- ⚠️ Yıl değiştirme işleminde eksik veya yanlış değişiklikler
- ⚠️ Her yıl için ayrı script ama yapılar farklı olabilir

### 4. **Eşleştirme Problemleri**
- ⚠️ Variant eşleştirmesi: Toy#, Casting Name, Mix bilgisi
- ⚠️ Model eşleştirmesi: Casting Name + SubSeries
- ⚠️ İsim varyasyonları (parantez içi renk bilgisi vb.)

### 5. **Resim İşleme**
- ⚠️ İki farklı resim tipi (Carded/Loose)
- ⚠️ URL temizleme (thumbnail/scale-to-width-down kaldırma)
- ⚠️ Resim yolu ve dosya isimlendirme tutarlılığı

## 💡 Mainline Yaklaşımı (Başarılı Örnek)

### Veri Çekme (import_2025_mainline.ts)
```typescript
// Sabit kolon indeksleri
const toyNumber = $(cells[0]).text().trim();
const collectorNumberStr = $(cells[1]).text().trim();
const modelNameRaw = $(cells[2]).text().trim();
const subSeriesName = $(cells[3]).text().trim();
const seriesInfoRaw = $(cells[4]).text().trim();
```

### Resim Çekme (download_and_sync_images_2025_mainline.ts)
```typescript
// Basit URL işleme
let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');
if (imgUrl.startsWith('//')) {
  imgUrl = 'https:' + imgUrl;
}
let fullImgUrl = imgUrl
  .replace(/\/scale-to-width-down\/\d+/g, '')
  .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');
```

## 🎯 Önerilen Yaklaşım

### 1. **Yıl Bazında Analiz**
- Her yıl için wiki sayfasını önce analiz et
- Tablo yapısını manuel olarak kontrol et
- Kolon indekslerini belirle
- Mix/subseries tespiti yap

### 2. **Basit ve Anlaşılır Script**
- Mainline scriptlerini örnek al
- Sabit kolon indeksleri kullan (mümkünse)
- Dinamik tespiti sadece gerektiğinde kullan
- Her yıl için ayrı, özelleştirilmiş script

### 3. **Aşamalı Geliştirme**
1. Önce 2025 yılını analiz et ve script hazırla
2. Test et, çalıştır
3. Sorunları tespit et ve düzelt
4. Diğer yıllara geç

## 📝 Notlar

- Boulevard serisi Mainline'dan daha karmaşık yapıya sahip
- Her yıl için tablo yapısı değişebilir
- İki resim tipi (Carded/Loose) yönetimi gerekli
- TH/STH filtreleri Boulevard'da devre dışı olmalı
- Alt seri (Mix) filtresi gerekli

## 🔄 Sonraki Adımlar

1. ✅ Analiz tamamlandı
2. ⏳ Boulevard scriptleri silinecek
3. ⏳ 2025 yılı wiki linki bekleniyor
4. ⏳ 2025 yılı tablosu analiz edilecek
5. ⏳ 2025 için veri ve resim scriptleri hazırlanacak






