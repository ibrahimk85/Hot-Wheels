# Veri Yönetimi Kullanım Kılavuzu

## Genel Bakış

Veri Yönetimi özellikleri, koleksiyonunuzun veri bütünlüğünü korumak, tutarsızlıkları tespit etmek ve verileri temizlemek için araçlar sağlar.

## Erişim

1. Ana menüden **"Veri Yönetimi"** linkine tıklayın
2. Veya doğrudan `/data-management` adresine gidin

## Özellikler

### 1. Veri Doğrulama

Koleksiyon verilerinizin tutarlılığını kontrol eder ve sorunları tespit eder.

#### Doğrulama Kontrolleri

- **Geçersiz Koleksiyon Referansları:** Model'lerin geçersiz koleksiyonlara ait olup olmadığını kontrol eder
- **Geçersiz Model Referansları:** Variant'ların geçersiz modellere ait olup olmadığını kontrol eder
- **Orphaned Images:** Hiçbir modele veya variant'a bağlı olmayan görselleri tespit eder
- **Geçersiz Alt Seri Referansları:** Model'lerin geçersiz alt serilere ait olup olmadığını kontrol eder
- **Duplicate Models:** Aynı koleksiyon içinde aynı isme sahip modelleri tespit eder
- **Duplicate Variants:** Aynı model, kart numarası ve renge sahip variant'ları tespit eder

#### Sorun Türleri

- **Hatalar (Errors):** Yüksek öncelikli sorunlar, düzeltilmesi gerekir
- **Uyarılar (Warnings):** Orta öncelikli sorunlar, dikkat edilmesi önerilir
- **Bilgiler (Info):** Düşük öncelikli bilgilendirmeler

#### Kullanım

1. "Yenile" butonuna tıklayarak doğrulama çalıştırın
2. Tespit edilen sorunları inceleyin
3. Her sorun için önerilen çözümü uygulayın
4. Sorun detaylarına tıklayarak ilgili entity'ye gidin

### 2. Duplicate Detection

Tekrarlanan modelleri ve variant'ları tespit eder ve birleştirmenize olanak sağlar.

#### Duplicate Tespiti

- **Model Duplicates:** Aynı `castingName` ve `collectionId`'ye sahip modeller
- **Variant Duplicates:** Aynı `modelId`, `cardNumber` ve `color`'a sahip variant'lar

#### Merge İşlemi

1. Tespit edilen duplicate'leri inceleyin
2. "Birleştir" butonuna tıklayın
3. Sistem otomatik olarak en uygun kaydı seçer:
   - **Modeller için:** En çok variant'a sahip olan tutulur
   - **Variant'lar için:** En çok bilgiye sahip olan tutulur
4. Merge işlemini onaylayın

#### Merge Sonrası

- Tutulan kayıt, birleştirilen kayıtların bilgilerini alır
- Variant'lar ve görseller tutulan kayda taşınır
- Birleştirilen kayıtlar silinir
- **Not:** Bu işlem geri alınamaz!

### 3. CSV/Excel Import

Koleksiyon verilerinizi CSV veya Excel dosyalarından içe aktarabilirsiniz.

#### Desteklenen Formatlar

- **JSON:** Mevcut export formatı
- **CSV:** Virgülle ayrılmış değerler
- **Excel:** .xlsx, .xls dosyaları

#### Column Mapping

CSV/Excel import için sütun eşleştirmesi yapmanız gerekir:

```json
{
  "0": "castingName",
  "1": "collectionName",
  "2": "year",
  "3": "owned",
  "4": "cardNumber",
  "5": "color"
}
```

#### Desteklenen Alanlar

- `castingName` (Zorunlu)
- `castingId`
- `collectionName` (Zorunlu)
- `year`
- `subSeriesName`
- `owned`
- `wishlisted`
- `quantity`
- `packedPrice`
- `loosePrice`
- `notes`
- `cardNumber`
- `color`
- `isTreasureHunt`
- `isSuperTreasureHunt`

#### Import Modları

- **Merge:** Mevcut kayıtları günceller, yeni kayıtlar ekler
- **Replace:** Tüm verileri değiştirir (henüz implement edilmedi)

### 4. Otomatik Yedekleme

Koleksiyon verilerinizi otomatik olarak yedekler.

#### Yedekleme Özellikleri

- **Zamanlanmış Yedeklemeler:** Günlük, haftalık veya aylık
- **Otomatik Temizleme:** Eski yedeklemeleri otomatik siler
- **Yedekleme Durumu:** Son yedekleme tarihi ve toplam yedekleme sayısı

#### Yedekleme İçeriği

- Veritabanı dosyası (`dev.db`)
- Görseller (zip formatında)
- Git commit hash
- Paket versiyonu
- Yedekleme metadata

#### Manuel Yedekleme

```bash
npm run backup:create
```

### 5. Audit Trail (Veri Geçmişi)

Tüm veri değişikliklerini kaydeder ve izler.

#### Kaydedilen Bilgiler

- **Kullanıcı:** Değişikliği yapan kullanıcı
- **Aksiyon:** `create`, `update`, `delete`, vb.
- **Entity Type:** `collection`, `model`, `variant`
- **Entity ID:** Değişiklik yapılan kayıt ID'si
- **Changes:** Değişiklik detayları (JSON formatında)
- **Timestamp:** Değişiklik zamanı

#### Kullanım

Audit trail otomatik olarak çalışır. Tüm veri değişiklikleri `CollectionHistory` tablosuna kaydedilir.

## API Endpoints

### Veri Doğrulama

```
GET /api/data-management/validate
```

### Duplicate Detection

```
GET /api/data-management/duplicates/models
GET /api/data-management/duplicates/variants
```

### Merge İşlemleri

```
POST /api/data-management/duplicates/merge-models
POST /api/data-management/duplicates/merge-variants
```

Body:
```json
{
  "keepId": 123,
  "mergeIds": [456, 789]
}
```

### Yedekleme Durumu

```
GET /api/data-management/backup/status
```

### Import

```
POST /api/import
```

Form Data:
- `file`: Dosya
- `format`: `json`, `csv`, `excel`
- `mode`: `merge`, `replace`
- `hasHeader`: `true`, `false` (CSV/Excel için)
- `columnMapping`: JSON string (CSV/Excel için)

## Sorun Giderme

### Doğrulama hataları görünmüyor

1. "Yenile" butonuna tıklayın
2. Tarayıcı konsolunu kontrol edin (F12)
3. API endpoint'lerinin çalıştığından emin olun

### Duplicate merge başarısız oluyor

1. Duplicate'lerin gerçekten aynı olduğundan emin olun
2. Tutulan kaydın (keepId) geçerli olduğundan emin olun
3. Birleştirilecek kayıtların (mergeIds) geçerli olduğundan emin olun

### CSV/Excel import çalışmıyor

1. Dosya formatının doğru olduğundan emin olun
2. Column mapping'in doğru yapılandırıldığından emin olun
3. Zorunlu alanların (`castingName`, `collectionName`) doldurulduğundan emin olun
4. Header satırının doğru işaretlendiğinden emin olun

### Yedekleme çalışmıyor

1. `backups` klasörünün yazılabilir olduğundan emin olun
2. Yeterli disk alanı olduğundan emin olun
3. Node.js process'lerinin çalıştığından emin olun

## Notlar

- Veri doğrulama, büyük koleksiyonlarda zaman alabilir
- Duplicate merge işlemi geri alınamaz, dikkatli kullanın
- CSV/Excel import için column mapping doğru yapılandırılmalıdır
- Otomatik yedekleme için cron job veya scheduled task kurulumu gerekebilir



