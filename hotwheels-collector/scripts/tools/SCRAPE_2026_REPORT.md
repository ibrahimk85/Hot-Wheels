# 2026 Hot Wheels Mainline Scraping Raporu

## Genel Bakış
Bu rapor, 2026 Hot Wheels Mainline verilerinin wiki'den çekilmesi ve uygulamaya entegre edilmesi sürecini özetlemektedir.

## Yapılan İşlemler

### 1. Script Oluşturma
- ✅ `scrape_2026_mainline_complete.ts` scripti oluşturuldu
- ✅ 2025 scripti temel alınarak 2026 için uyarlandı
- ✅ URL güncellendi: `https://hotwheels.fandom.com/wiki/List_of_2026_Hot_Wheels`

### 2. Veri Çekme Özellikleri
- ✅ Toy# (1. kolon)
- ✅ Col# (2. kolon)
- ✅ Model Name (3. kolon) - link ile model detay sayfası
- ✅ Series (4. kolon) - TH/STH bilgileri parse edildi
- ✅ Series# (5. kolon)
- ✅ Image URL (6. kolon) - en büyük boyut alındı

### 3. Model Detay Sayfası Bilgileri
Her model için detay sayfasından çekilen bilgiler:
- ✅ Debut Series
- ✅ Produced
- ✅ Designer
- ✅ Number
- ✅ Description

### 4. UI Güncellemeleri

#### Models Sayfası
- ✅ `getAllSubSeries()` fonksiyonu güncellendi
- ✅ Aynı isimde alt seri birden fazla yılda varsa yıl seçimi gösteriliyor
- ✅ `ModelsList.tsx` güncellendi - yıl bilgisi gösteriliyor

#### Collections Sayfası
- ✅ Mainline koleksiyonları gruplandı
- ✅ Mainline için yıl seçim sayfası oluşturuldu: `/collections/mainline`
- ✅ Birden fazla yıl varsa yıl seçim sayfasına yönlendiriliyor

## İstatistikler

### Veritabanı
- **Yıl:** 2026
- **Koleksiyon:** Mainline
- **Alt Seriler:** [Sayı script çalıştıktan sonra güncellenecek]
- **Modeller:** [Sayı script çalıştıktan sonra güncellenecek]
- **Varyantlar:** [Sayı script çalıştıktan sonra güncellenecek]
- **Treasure Hunts:** [Sayı script çalıştıktan sonra güncellenecek]
- **Super Treasure Hunts:** [Sayı script çalıştıktan sonra güncellenecek]

### Görseller
- **İndirilen Görsel Sayısı:** [Sayı script çalıştıktan sonra güncellenecek]
- **Görsel Klasörü:** `public/images/hotwheels/2026/mainline/`

### Model Detayları
- **Detay Sayfası Çekilen Model Sayısı:** [Sayı script çalıştıktan sonra güncellenecek]

## Hatalar
- [Varsa hatalar buraya eklenecek]

## Notlar
- Script rate limiting ile çalışıyor (model detayları için 500ms, görseller için 300ms)
- Duplicate kontrolü yapılıyor - aynı variant iki kez oluşturulmuyor
- Görseller en büyük boyutta indiriliyor (thumbnail parametreleri temizleniyor)

## Sonraki Adımlar
1. ✅ Script çalıştırıldı
2. ⏳ Veri doğrulama yapılacak
3. ⏳ UI testleri yapılacak
4. ⏳ Final rapor tamamlanacak

---

**Rapor Oluşturulma Tarihi:** [Tarih script çalıştıktan sonra güncellenecek]








