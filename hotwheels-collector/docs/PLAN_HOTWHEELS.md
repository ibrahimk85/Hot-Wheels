# Hot Wheels Koleksiyon Yönetim Sistemi - Proje Planı

## 📋 Proje Özeti

Hot Wheels koleksiyonunu dijital ortamda yönetmek için geliştirilen bir web uygulaması. Kullanıcılar koleksiyonlarındaki modelleri, varyantları ve görselleri kaydedip yönetebilecek.

## 🎯 Temel Özellikler

### 1. Koleksiyon Yönetimi
- Yıllara göre koleksiyonlar (2024, 2025, vb.)
- Koleksiyon türleri (Mainline, Car Culture, Premium, vb.)
- Alt seriler (SubSeries) yönetimi
- Koleksiyon detay sayfaları

### 2. Model Yönetimi
- Model listeleme ve arama
- Model detay sayfaları
- Casting bilgileri (casting name, casting ID)
- Model açıklamaları
- Model görselleri

### 3. Varyant Yönetimi
- Varyant listeleme ve filtreleme
- Varyant detay bilgileri:
  - Yıl
  - Renk
  - Kart numarası
  - Jant tipi
  - Treasure Hunt / Super Treasure Hunt işaretleme
  - Sahiplik durumu (owned)
  - Miktar (quantity)
  - Durum (condition)
  - Notlar
- Varyant görselleri

### 4. Görsel Yönetimi
- Görsel yükleme ve saklama
- Model ve varyant görselleri
- Görsel metadata (alt text, path)

### 5. İstatistikler ve Raporlar
- Toplam model sayısı
- Toplam varyant sayısı
- Sahip olunan varyant sayısı
- Koleksiyon bazlı istatistikler
- Yıl bazlı istatistikler

## 🗄️ Veritabanı Şeması

### Modeller

#### Year
- `id`: Primary key
- `year`: Yıl (Int)
- `notes`: Notlar (String?)
- `collections`: Collection[] (İlişki)

#### Collection
- `id`: Primary key
- `name`: Koleksiyon adı (String) - "Mainline", "Car Culture", vb.
- `code`: Koleksiyon kodu (String?) - "HW Mainline", "TH", "STH"
- `yearId`: Year ilişkisi (Int)
- `year`: Year (İlişki)
- `subSeries`: SubSeries[] (İlişki)
- `models`: Model[] (İlişki)

#### SubSeries
- `id`: Primary key
- `name`: Alt seri adı (String)
- `collectionId`: Collection ilişkisi (Int)
- `collection`: Collection (İlişki)
- `models`: Model[] (İlişki)

#### Model
- `id`: Primary key
- `castingName`: Casting adı (String)
- `castingId`: Casting ID (String?)
- `description`: Açıklama (String?)
- `mainImageId`: Ana görsel ID (Int?)
- `collectionId`: Collection ilişkisi (Int)
- `collection`: Collection (İlişki)
- `subSeriesId`: SubSeries ilişkisi (Int?)
- `subSeries`: SubSeries? (İlişki)
- `variants`: Variant[] (İlişki)
- `images`: Image[] (İlişki)

#### Variant
- `id`: Primary key
- `modelId`: Model ilişkisi (Int)
- `model`: Model (İlişki)
- `year`: Yıl (Int)
- `releaseName`: Yayın adı (String?)
- `color`: Renk (String?)
- `cardNumber`: Kart numarası (String?)
- `isTreasureHunt`: Treasure Hunt mu? (Boolean, default: false)
- `isSuperTreasureHunt`: Super Treasure Hunt mu? (Boolean, default: false)
- `wheelType`: Jant tipi (String?)
- `cardVariation`: Kart varyasyonu (String?)
- `imageId`: Görsel ID (Int?)
- `owned`: Sahip olunan mı? (Boolean, default: false)
- `quantity`: Miktar (Int, default: 0)
- `condition`: Durum (String?)
- `notes`: Notlar (String?)
- `images`: Image[] (İlişki)

#### Image
- `id`: Primary key
- `path`: Görsel yolu (String) - public klasörüne göre relative path
- `alt`: Alt text (String?)
- `variantId`: Variant ilişkisi (Int?)
- `variant`: Variant? (İlişki)
- `modelId`: Model ilişkisi (Int?)
- `model`: Model? (İlişki)

## 🛠️ Teknoloji Stack'i

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (UI bileşenleri)
- **Lucide React** (İkonlar)

### Backend & Veritabanı
- **Prisma** (ORM)
- **SQLite** (Geliştirme veritabanı)
- **@prisma/client**

### Form Yönetimi & Validasyon
- **react-hook-form**
- **@hookform/resolvers**
- **zod** (Schema validasyon)

### Tablo & Veri Yönetimi
- **@tanstack/react-table**

## 📁 Proje Yapısı

```
hotwheels-collector/
├── src/
│   ├── app/                    # Next.js App Router sayfaları
│   │   ├── layout.tsx         # Ana layout (header, footer)
│   │   ├── page.tsx           # Ana sayfa
│   │   ├── collections/       # Koleksiyon sayfaları
│   │   ├── models/            # Model sayfaları
│   │   └── variants/          # Varyant sayfaları
│   ├── db/
│   │   └── index.ts           # Prisma client export
│   ├── features/
│   │   ├── collections/        # Collection domain
│   │   │   └── collection.service.ts
│   │   ├── models/            # Model domain
│   │   │   └── model.service.ts
│   │   ├── variants/          # Variant domain
│   │   │   └── variant.service.ts
│   │   └── images/            # Image domain
│   │       └── image.service.ts
│   ├── ui/                    # UI bileşenleri (shadcn/ui)
│   └── lib/                   # Yardımcı fonksiyonlar
├── prisma/
│   ├── schema.prisma          # Prisma şema tanımları
│   └── migrations/            # Veritabanı migration'ları
├── public/
│   └── images/
│       └── hotwheels/         # Hot Wheels görselleri
├── scripts/
│   ├── import/                # Veri import scriptleri
│   └── tools/                 # Yardımcı araçlar
└── docs/                      # Dokümantasyon
```

## 🚀 Geliştirme Aşamaları

### Faz 1: Temel Altyapı ✅
- [x] Next.js projesi oluşturma
- [x] Prisma kurulumu ve veritabanı şeması
- [x] Temel klasör yapısı
- [x] Layout ve sayfa iskeletleri
- [x] Temel servis dosyaları

### Faz 2: Koleksiyon Yönetimi
- [ ] Koleksiyon listeleme sayfası
- [ ] Koleksiyon detay sayfası
- [ ] Koleksiyon oluşturma/düzenleme formu
- [ ] Koleksiyon servis fonksiyonları (CRUD)

### Faz 3: Model Yönetimi
- [ ] Model listeleme sayfası (filtreleme, arama)
- [ ] Model detay sayfası
- [ ] Model oluşturma/düzenleme formu
- [ ] Model servis fonksiyonları (CRUD)
- [ ] Model görsel yükleme

### Faz 4: Varyant Yönetimi
- [ ] Varyant listeleme sayfası (gelişmiş filtreleme)
- [ ] Varyant detay sayfası
- [ ] Varyant oluşturma/düzenleme formu
- [ ] Varyant servis fonksiyonları (CRUD)
- [ ] Sahiplik durumu yönetimi
- [ ] Varyant görsel yükleme

### Faz 5: Görsel Yönetimi
- [ ] Görsel yükleme komponenti
- [ ] Görsel galeri görünümü
- [ ] Görsel silme/düzenleme
- [ ] Görsel servis fonksiyonları

### Faz 6: İstatistikler ve Dashboard
- [ ] Ana sayfa istatistikleri
- [ ] Koleksiyon bazlı istatistikler
- [ ] Yıl bazlı istatistikler
- [ ] Grafik ve görselleştirmeler

### Faz 7: İleri Özellikler
- [ ] Veri import/export (CSV, JSON)
- [ ] Arama ve filtreleme geliştirmeleri
- [ ] Toplu işlemler
- [ ] Yazdırma özellikleri
- [ ] Mobil uyumluluk iyileştirmeleri

## 📝 API Rotaları (Gerekirse)

Next.js App Router kullanıldığı için API route'ları `src/app/api/` klasöründe oluşturulabilir:

- `GET /api/collections` - Koleksiyonları listele
- `GET /api/collections/[id]` - Koleksiyon detayı
- `POST /api/collections` - Yeni koleksiyon oluştur
- `PUT /api/collections/[id]` - Koleksiyon güncelle
- `DELETE /api/collections/[id]` - Koleksiyon sil

Benzer şekilde models, variants ve images için de API route'ları oluşturulabilir.

## 🎨 UI/UX Tasarım Prensipleri

- **Modern ve temiz arayüz**: shadcn/ui bileşenleri kullanarak
- **Responsive tasarım**: Mobil ve masaüstü uyumlu
- **Kolay navigasyon**: Net menü yapısı
- **Hızlı arama ve filtreleme**: Kullanıcı deneyimini artırmak için
- **Görsel odaklı**: Hot Wheels modellerinin görselleri ön planda

## 🔒 Güvenlik ve Performans

- **Veri validasyonu**: Zod ile form validasyonu
- **Görsel optimizasyonu**: Next.js Image component kullanımı
- **Veritabanı optimizasyonu**: Prisma query optimizasyonu
- **Hata yönetimi**: Uygun error handling

## 📦 Deployment

- **Vercel** (önerilen) veya benzer platform
- **Veritabanı**: SQLite (geliştirme) → PostgreSQL (production)
- **Görsel depolama**: Vercel Blob Storage veya benzer servis

## 📚 Dokümantasyon

- Kod içi yorumlar
- README.md dosyası
- API dokümantasyonu (eğer API route'ları kullanılırsa)
- Kullanım kılavuzu

## 🔄 Sürekli İyileştirme

- Kullanıcı geri bildirimleri
- Performans optimizasyonları
- Yeni özellik eklemeleri
- Hata düzeltmeleri

---

**Son Güncelleme**: 30 Kasım 2025

