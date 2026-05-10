# Gelişmiş İstatistikler ve Analitik Kullanım Kılavuzu

## Genel Bakış

Bu özellik, Hot Wheels koleksiyonunuzun detaylı analizini yapmanıza ve yatırım performansınızı değerlendirmenize olanak sağlar.

## Erişim

1. Ana menüden **"İstatistikler"** linkine tıklayın
2. Veya doğrudan `/analytics` adresine gidin

## Özellikler

### 1. Yatırım Analizi

Koleksiyonunuzun yatırım performansını analiz edin:

- **Toplam Yatırım:** Koleksiyonunuza yaptığınız toplam yatırım
- **Güncel Değer:** Koleksiyonunuzun şu anki toplam değeri
- **Kar/Zarar:** Yatırımınızdan elde ettiğiniz kar veya zarar
- **ROI (Return on Investment):** Yatırım getiri oranı yüzdesi

#### En İyi ve En Kötü Yatırımlar

- **En İyi Yatırım:** En yüksek kar getiren model
- **En Kötü Yatırım:** En düşük performans gösteren model

#### Kategoriye Göre Yatırım Analizi

Her koleksiyon kategorisi için ayrı yatırım analizi:
- Toplam yatırım
- Güncel değer
- Kar/zarar miktarı ve yüzdesi

### 2. Tamamlanma Oranı

Koleksiyonlarınızın tamamlanma durumunu görüntüleyin:

#### Genel Tamamlanma

- **Toplam İlerleme:** Tüm koleksiyonlar için genel tamamlanma yüzdesi
- **Toplam Model:** Tüm koleksiyonlardaki toplam model sayısı
- **Sahip Olunan:** Sahip olduğunuz model sayısı
- **Eksik:** Eksik model sayısı
- **Tamamlanan Koleksiyon:** Tamamladığınız koleksiyon sayısı

#### Koleksiyon Bazında Tamamlanma

Her koleksiyon için:
- Tamamlanma yüzdesi (progress bar ile görselleştirilmiş)
- Sahip olunan / Toplam model sayısı
- Eksik model sayısı
- Tamamlanan koleksiyonlar için ✓ işareti

Koleksiyon adına tıklayarak detay sayfasına gidebilirsiniz.

### 3. Gelişmiş Grafikler

#### Koleksiyon Büyüme Zaman Çizelgesi

Zaman içinde koleksiyonunuzun büyümesini görselleştirir:
- **X Ekseni:** Yıllar
- **Y Ekseni (Sol):** Model sayısı
- **Y Ekseni (Sağ):** Koleksiyon değeri (TL)

#### Yıllara Göre Koleksiyon Değeri (Heatmap)

Yıllara göre koleksiyon değerini renk skalası ile gösterir:
- **Kırmızı:** Düşük değer
- **Sarı:** Orta değer
- **Yeşil:** Yüksek değer

## API Endpoints

### Yatırım Analizi

```
GET /api/analytics/investment
```

**Query Parametreleri:**
- `type`: `roi` (tek model için ROI), `estimate` (tahmin), veya boş (tam analiz)
- `modelId`: ROI için model ID (type=roi ile birlikte)
- `months`: Tahmin için ay sayısı (type=estimate ile birlikte)

### Tamamlanma Oranı

```
GET /api/analytics/completion/overall
GET /api/analytics/completion/collections?collectionId={id}
GET /api/analytics/completion/by-year
```

### Gelişmiş İstatistikler

```
GET /api/analytics/advanced-stats
```

**Query Parametreleri:**
- `type`: `by-year`, `by-collection`, `growth-timeline`, veya boş (genel istatistikler)
- `year`: Yıl filtresi (genel istatistikler için)
- `months`: Ay sayısı (growth-timeline için)

## Teknik Detaylar

### Veri Hesaplama

- **Yatırım Analizi:** Model fiyatları (packedPrice/loosePrice) kullanılarak hesaplanır
- **Tamamlanma Oranı:** Sahip olunan modeller / Toplam modeller
- **ROI:** (Güncel Değer - Yatırım) / Yatırım * 100

### Grafik Kütüphanesi

- **Recharts** kullanılarak oluşturulmuştur
- Responsive tasarım ile tüm ekran boyutlarında çalışır

## Notlar

- Yatırım analizi, model fiyatlarının doğru girilmesine bağlıdır
- Tamamlanma oranı, koleksiyonlardaki tüm modellerin veritabanında tanımlı olmasını gerektirir
- Grafikler gerçek zamanlı olarak güncellenir

## Sorun Giderme

### Grafikler görünmüyor

1. Tarayıcı konsolunu kontrol edin (F12)
2. API endpoint'lerinin çalıştığından emin olun
3. Veritabanında yeterli veri olduğundan emin olun

### Yatırım analizi yanlış görünüyor

1. Model fiyatlarının doğru girildiğini kontrol edin
2. Sahip olunan modellerin (`owned: true`) doğru işaretlendiğini kontrol edin

### Tamamlanma oranı %0 gösteriyor

1. Koleksiyonlarda modellerin tanımlı olduğundan emin olun
2. Sahip olunan modellerin doğru işaretlendiğini kontrol edin



