# Gelişmiş Fiyat Takibi Kullanım Kılavuzu

## 📍 Genel Bakış

AŞAMA 4'te eklenen Gelişmiş Fiyat Takibi özellikleri:
- **Fiyat Trend Analizi**: Model/varyant için fiyat geçmişi grafikleri
- **Piyasa Analizi**: Ortalama, min/max, trend, değişim yüzdesi
- **Fiyat Uyarıları**: Hedef fiyata ulaşıldığında bildirim
- **Kaynak Karşılaştırması**: Farklı kaynaklardan fiyat karşılaştırması

---

## 🎯 1. Fiyat Trend Grafiği

### Model Detay Sayfasında

1. Herhangi bir model detay sayfasına gidin (örnek: `/model/123`)
2. Sayfanın altında **"Fiyat Trendi"** bölümünü bulun
3. Grafik otomatik olarak yüklenir ve son 30 günün fiyat verilerini gösterir

**Özellikler:**
- **Zaman Aralığı Seçimi**: 7, 30, 90, 180 gün seçenekleri
- **Kaynak Gösterimi**: Farklı kaynaklar (eBay, Wiki, vb.) farklı renklerle gösterilir
- **Piyasa Analizi**: Ortalama, minimum, maksimum fiyat ve trend bilgisi

**Grafik Bilgileri:**
- **Ortalama Fiyat**: Belirtilen süre içindeki ortalama fiyat
- **Minimum Fiyat**: En düşük fiyat
- **Maksimum Fiyat**: En yüksek fiyat
- **Değişim**: Fiyat değişimi (TL ve yüzde olarak)
- **Trend**: Artış (↑), Azalış (↓), veya Stabil (→)

---

## 🔔 2. Fiyat Uyarıları

### Uyarı Oluşturma

1. Model detay sayfasında sağ üstteki **"Fiyat Uyarısı"** (🔔) butonuna tıklayın
2. Açılan dialog'da:
   - **Hedef Fiyat**: İstediğiniz fiyatı girin (örnek: 100.00 TL)
   - **Koşul**: 
     - **Fiyat düştüğünde (Altında)**: Fiyat belirlediğiniz değerin altına düştüğünde uyarı
     - **Fiyat yükseldiğinde (Üstünde)**: Fiyat belirlediğiniz değerin üstüne çıktığında uyarı
     - **Fiyat eşit olduğunda**: Fiyat tam olarak belirlediğiniz değere eşit olduğunda uyarı
3. **"Uyarı Oluştur"** butonuna tıklayın

**Örnek Senaryolar:**

**Senaryo 1: İyi Fırsat Bekleme**
- Hedef Fiyat: 50 TL
- Koşul: "Fiyat düştüğünde (Altında)"
- Açıklama: Model 50 TL'nin altına düştüğünde uyarı alırsınız

**Senaryo 2: Yatırım İzleme**
- Hedef Fiyat: 200 TL
- Koşul: "Fiyat yükseldiğinde (Üstünde)"
- Açıklama: Model 200 TL'nin üstüne çıktığında uyarı alırsınız

### Uyarıları Görüntüleme

1. Model detay sayfasında **"Fiyat Uyarısı"** butonuna tıklayın
2. Dialog'da **"Aktif Uyarılar"** bölümünde tüm uyarılarınızı görebilirsiniz
3. Her uyarı için:
   - Koşul ve hedef fiyat görüntülenir
   - Tetiklendi ise yeşil badge gösterilir
   - Pasif ise gri badge gösterilir
   - Tetiklenme tarihi gösterilir

### Uyarı Silme

1. Uyarı dialog'unda silmek istediğiniz uyarının yanındaki **X** butonuna tıklayın
2. Uyarı silinir

---

## 📊 3. Piyasa Analizi

### Model Detay Sayfasında

Fiyat trend grafiğinin altında otomatik olarak gösterilir:

**Gösterilen Bilgiler:**
- **Ortalama**: Seçilen süre içindeki ortalama fiyat
- **Minimum**: En düşük fiyat
- **Maksimum**: En yüksek fiyat
- **Değişim**: Fiyat değişimi (yeşil: artış, kırmızı: azalış)

**Trend Göstergesi:**
- 🟢 **Artış**: Fiyatlar genel olarak yükseliyor
- 🔴 **Azalış**: Fiyatlar genel olarak düşüyor
- ⚪ **Stabil**: Fiyatlar sabit kalıyor

---

## 🔄 4. API Kullanımı (Geliştiriciler İçin)

### Fiyat Trend Verileri

**Endpoint:** `GET /api/pricing/trend`

**Parametreler:**
- `modelId` (opsiyonel): Model ID
- `variantId` (opsiyonel): Varyant ID
- `days` (opsiyonel, varsayılan: 30): Gün sayısı
- `type` (opsiyonel): "trend", "analysis", "compare"

**Örnek 1: Trend Verisi**
```javascript
const response = await fetch('/api/pricing/trend?modelId=123&days=30');
const trends = await response.json();
// [{ date: Date, price: number, source: string }, ...]
```

**Örnek 2: Piyasa Analizi**
```javascript
const response = await fetch('/api/pricing/trend?modelId=123&days=30&type=analysis');
const analysis = await response.json();
// {
//   averagePrice: number,
//   minPrice: number,
//   maxPrice: number,
//   trend: "increasing" | "decreasing" | "stable",
//   priceChange: number,
//   priceChangePercent: number,
//   dataPoints: number
// }
```

**Örnek 3: Kaynak Karşılaştırması**
```javascript
const response = await fetch('/api/pricing/trend?modelId=123&type=compare');
const comparison = await response.json();
// {
//   "ebay": { price: number, count: number, latestDate: Date },
//   "wiki": { price: number, count: number, latestDate: Date },
//   ...
// }
```

---

### Fiyat Uyarıları

**Uyarıları Listeleme:**
```javascript
GET /api/pricing/alerts?userId=1&activeOnly=true

// Response:
[
  {
    id: 1,
    userId: 1,
    modelId: 123,
    targetPrice: 100,
    condition: "below",
    active: true,
    notified: false,
    createdAt: "2025-12-07T...",
    triggeredAt: null
  }
]
```

**Uyarı Oluşturma:**
```javascript
POST /api/pricing/alerts
{
  "userId": 1,
  "modelId": 123,
  "targetPrice": 100,
  "condition": "below"
}
```

**Uyarı Güncelleme:**
```javascript
PUT /api/pricing/alerts/1
{
  "targetPrice": 90,
  "condition": "below",
  "active": true
}
```

**Uyarı Silme:**
```javascript
DELETE /api/pricing/alerts/1
```

---

### Otomatik Uyarı Kontrolü

**Endpoint:** `POST /api/pricing/check-alerts`

Bu endpoint bir cron job veya scheduled task tarafından periyodik olarak çağrılabilir:

```javascript
// Örnek: Her saat başı kontrol et
const response = await fetch('/api/pricing/check-alerts', {
  method: 'POST'
});

const result = await response.json();
// {
//   message: "Price alerts checked",
//   triggeredCount: 2,
//   triggeredAlerts: [...]
// }
```

**Cron Job Örneği (Node.js):**
```javascript
// Her saat başı çalıştır
setInterval(async () => {
  await fetch('http://localhost:3000/api/pricing/check-alerts', {
    method: 'POST'
  });
}, 60 * 60 * 1000); // 1 saat
```

---

## 💡 5. Pratik Kullanım Senaryoları

### Senaryo 1: Yeni Model İzleme

1. İlgilendiğiniz bir modeli bulun
2. Model detay sayfasına gidin
3. Fiyat trend grafiğini kontrol edin
4. İyi bir fırsat fiyatı belirleyin (örnek: 50 TL)
5. "Fiyat Uyarısı" butonuna tıklayın
6. Hedef fiyat: 50 TL, Koşul: "Fiyat düştüğünde (Altında)"
7. Uyarı oluşturun
8. Fiyat 50 TL'nin altına düştüğünde uyarı alırsınız

### Senaryo 2: Yatırım Değeri Takibi

1. Sahip olduğunuz bir modelin detay sayfasına gidin
2. Fiyat trend grafiğini inceleyin
3. Piyasa analizini kontrol edin:
   - Trend artış gösteriyor mu?
   - Ortalama fiyat ne kadar?
   - Maksimum fiyat ne kadar?
4. Satış kararı vermek için:
   - Hedef fiyat: 200 TL
   - Koşul: "Fiyat yükseldiğinde (Üstünde)"
   - Uyarı oluşturun

### Senaryo 3: Koleksiyon Değer Analizi

1. Tüm modelleriniz için fiyat trendlerini inceleyin
2. Her model için piyasa analizini kontrol edin
3. Trend artış gösteren modelleri belirleyin
4. Bu modeller için uyarılar oluşturun

---

## 📱 6. Model Detay Sayfası Özellikleri

Model detay sayfasında (`/model/[modelId]`) şu özellikler mevcut:

1. **Fiyat Uyarısı Butonu** (sağ üstte)
   - Uyarı oluşturma
   - Mevcut uyarıları görüntüleme
   - Uyarı silme

2. **Fiyat Tahmini** (sayfanın altında)
   - AI ile fiyat tahmini
   - Trend analizi
   - Zaman aralığı seçimi

3. **Fiyat Trendi** (sayfanın altında)
   - Grafik görünümü
   - Piyasa analizi
   - Zaman aralığı seçimi (7, 30, 90, 180 gün)

---

## ⚙️ 7. Uyarı Yönetimi

### Aktif Uyarıları Görüntüleme

1. Model detay sayfasında "Fiyat Uyarısı" butonuna tıklayın
2. Dialog'da "Aktif Uyarılar" bölümünde tüm uyarılarınızı görebilirsiniz

### Uyarı Durumları

- **Aktif**: Uyarı aktif ve kontrol ediliyor
- **Tetiklenmiş**: Uyarı koşulu sağlandı (yeşil badge)
- **Pasif**: Uyarı devre dışı bırakıldı

### Uyarı Silme

- Uyarı dialog'unda X butonuna tıklayın
- Veya API ile: `DELETE /api/pricing/alerts/{id}`

---

## 🔍 8. Fiyat Verisi Kaynakları

Fiyat verileri şu kaynaklardan toplanabilir:

1. **eBay**: eBay API veya scraping
2. **Hot Wheels Wiki**: Wiki'den fiyat bilgisi
3. **Google Lens**: Görsel tanıma ile fiyat tespiti
4. **Manuel**: Kullanıcı tarafından manuel eklenen fiyatlar

**Not:** Şu anda fiyat verileri `PriceHistory` tablosunda saklanıyor. Otomatik fiyat güncellemeleri için scheduled job'lar kurulabilir.

---

## 📈 9. Trend Analizi Özellikleri

### Trend Hesaplama

Trend analizi şu şekilde yapılır:
1. Fiyat geçmişi iki yarıya bölünür
2. İlk yarı ve ikinci yarının ortalamaları karşılaştırılır
3. %5'ten fazla artış varsa: **Artış**
4. %5'ten fazla azalış varsa: **Azalış**
5. Aksi halde: **Stabil**

### Grafik Özellikleri

- **Çizgi Grafiği**: Zaman içindeki fiyat değişimi
- **Kaynak Renkleri**: Farklı kaynaklar farklı renklerle gösterilir
- **Tooltip**: Grafik üzerine gelindiğinde detaylı bilgi
- **Responsive**: Mobil cihazlarda da çalışır

---

## ⚠️ 10. Önemli Notlar

1. **Fiyat Verisi**: Fiyat trendleri için `PriceHistory` tablosunda veri olmalıdır. Eğer veri yoksa grafik boş görünecektir.

2. **Uyarı Kontrolü**: Uyarılar otomatik olarak kontrol edilmez. `POST /api/pricing/check-alerts` endpoint'ini periyodik olarak çağırmanız gerekir (cron job).

3. **Kullanıcı ID**: Uyarılar için kullanıcı ID'si gereklidir. Giriş yapmış kullanıcılar için localStorage'dan alınır.

4. **Fiyat Birimi**: Şu anda TL (Türk Lirası) kullanılıyor. Farklı para birimleri için `PriceHistory` tablosundaki `currency` alanı kullanılabilir.

---

## 🚀 11. Hızlı Başlangıç

1. **Model Detay Sayfasına Gidin**
   - Örnek: `http://localhost:3000/model/123`

2. **Fiyat Trendini İnceleyin**
   - Sayfanın altında "Fiyat Trendi" bölümünü bulun
   - Zaman aralığını seçin (7, 30, 90, 180 gün)

3. **Uyarı Oluşturun**
   - Sağ üstteki "Fiyat Uyarısı" butonuna tıklayın
   - Hedef fiyat ve koşul belirleyin
   - "Uyarı Oluştur" butonuna tıklayın

4. **Uyarıları Yönetin**
   - Dialog'da aktif uyarıları görüntüleyin
   - Gereksiz uyarıları silin

---

## 📝 12. API Örnekleri

### Tam Örnek: Fiyat Trend ve Uyarı Sistemi

```javascript
// 1. Fiyat trendini al
const trendResponse = await fetch('/api/pricing/trend?modelId=123&days=30');
const trends = await trendResponse.json();

// 2. Piyasa analizini al
const analysisResponse = await fetch('/api/pricing/trend?modelId=123&days=30&type=analysis');
const analysis = await analysisResponse.json();

console.log('Trend:', trends);
console.log('Analiz:', analysis);

// 3. Uyarı oluştur
const userId = localStorage.getItem('userId');
const alertResponse = await fetch('/api/pricing/alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: parseInt(userId),
    modelId: 123,
    targetPrice: 100,
    condition: 'below'
  })
});

// 4. Uyarıları kontrol et (cron job)
const checkResponse = await fetch('/api/pricing/check-alerts', {
  method: 'POST'
});
const checkResult = await checkResponse.json();
console.log('Tetiklenen uyarılar:', checkResult.triggeredAlerts);
```

---

**İyi kullanımlar! 🚀**



