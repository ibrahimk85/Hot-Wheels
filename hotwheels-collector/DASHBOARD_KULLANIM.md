# Özelleştirilebilir Dashboard Kullanım Kılavuzu

## 📍 Nasıl Ulaşılır?

### Yöntem 1: Sidebar Menü
1. Sol taraftaki sidebar menüsünde **"Özelleştirilebilir Dashboard"** linkine tıklayın
2. Veya direkt olarak `/dashboard` adresine gidin

### Yöntem 2: Ana Dashboard'dan
1. Ana sayfada (Dashboard) sağ üstte **"Özelleştirilebilir Dashboard"** butonuna tıklayın

### Yöntem 3: Mobil Navigasyon
1. Mobil cihazlarda alt navigasyon menüsünden **"Özelleştirilebilir"** seçeneğine tıklayın

---

## 🎨 Nasıl Kullanılır?

### 1. İlk Kullanım
- İlk kez açtığınızda otomatik olarak varsayılan bir dashboard layout'u oluşturulur
- Varsayılan layout şu widget'ları içerir:
  - **Koleksiyon Özeti** (İstatistikler)
  - **Koleksiyon Dağılımı** (Pasta Grafiği)
  - **Son Eklenenler** (Koleksiyon Listesi)
  - **Aktif Hedefler** (Hedef İlerlemesi)

### 2. Widget'ları Sürükle-Bırak ile Yeniden Düzenleme
1. Bir widget'ın üzerine gelin
2. Widget'ı tutup sürükleyin
3. İstediğiniz yere bırakın
4. Değişiklikler otomatik olarak kaydedilir

### 3. Yeni Widget Ekleme
1. Sağ üstteki **"Widget Ekle"** butonuna tıklayın
2. Açılan pencerede:
   - **Widget Tipi** seçin (İstatistikler, Grafik, Koleksiyon, Hedefler, Başarımlar)
   - **Boyut** seçin (1x1, 2x1, 1x2, 2x2)
   - **Başlık** girin (isteğe bağlı)
   - Widget tipine göre özel ayarları yapın
3. **"Kaydet"** butonuna tıklayın

### 4. Widget Düzenleme
1. Widget'ın üzerine gelin
2. Sağ üstte görünen **⚙️ (Ayarlar)** ikonuna tıklayın
3. Açılan pencerede ayarları değiştirin
4. **"Kaydet"** butonuna tıklayın

### 5. Widget Tipleri ve Özellikleri

#### 📊 İstatistikler Widget'ı
- **Boyutlar:** 1x1, 2x1, 2x2
- **Ayarlar:**
  - Toplam Model göster/gizle
  - Toplam Varyant göster/gizle
  - Sahip Olunan göster/gizle
  - Koleksiyon Değeri göster/gizle

#### 📈 Grafik Widget'ı
- **Boyutlar:** 2x2 (önerilen)
- **Grafik Tipleri:**
  - Pasta Grafiği
  - Çubuk Grafik
  - Çizgi Grafik
- **Veri Kaynakları:**
  - Koleksiyon Dağılımı
  - Yıl Dağılımı
  - Seri Dağılımı

#### 📦 Koleksiyon Widget'ı
- **Boyutlar:** 1x1, 2x1, 1x2
- **Gösterim Tipleri:**
  - Son Eklenenler
  - Değerli Modeller
  - Eksik Modeller
- **Limit:** 1-20 arası

#### 🎯 Hedefler Widget'ı
- **Boyutlar:** 1x1, 2x1, 1x2
- **Ayarlar:**
  - Gösterilecek hedef sayısı (1-10)
  - Tamamlananları göster/gizle

#### 🏆 Başarımlar Widget'ı
- **Boyutlar:** 1x1, 2x1, 1x2
- **Ayarlar:**
  - Gösterilecek başarım sayısı (1-20)

### 6. Widget Boyutları
- **1x1:** Küçük widget (tek hücre)
- **2x1:** Geniş widget (2 hücre genişliğinde)
- **1x2:** Uzun widget (2 hücre yüksekliğinde)
- **2x2:** Büyük widget (2x2 hücre)

---

## 💡 İpuçları

1. **Grid Düzeni:** Dashboard 2 sütunlu bir grid sisteminde çalışır. Widget'lar bu grid'e göre yerleştirilir.

2. **Otomatik Kaydetme:** Widget'ları sürükleyip bıraktığınızda değişiklikler otomatik olarak kaydedilir.

3. **Responsive Tasarım:** Dashboard mobil cihazlarda da çalışır, ancak widget düzenleme için masaüstü önerilir.

4. **Varsayılan Layout:** Her zaman bir varsayılan layout vardır. İsterseniz yeni layout'lar oluşturabilirsiniz (gelecek özellik).

5. **Widget Sayısı:** İstediğiniz kadar widget ekleyebilirsiniz, ancak performans için 10-15 widget önerilir.

---

## 🔧 Sorun Giderme

### Dashboard yüklenmiyor
- Sayfayı yenileyin (F5)
- Tarayıcı konsolunu kontrol edin
- API endpoint'lerinin çalıştığından emin olun

### Widget'lar görünmüyor
- Varsayılan layout oluşturulmamış olabilir
- Sayfayı yenileyin
- Veritabanında widget kayıtlarını kontrol edin

### Drag & drop çalışmıyor
- Tarayıcınızın JavaScript'i desteklediğinden emin olun
- Sayfayı yenileyin
- Başka bir tarayıcı deneyin

---

## 📝 Notlar

- Dashboard ayarları tarayıcıda saklanır (localStorage kullanılmıyor, veritabanında saklanıyor)
- Widget'lar gerçek zamanlı veri gösterir
- Her widget kendi API endpoint'ini kullanır

---

**İyi kullanımlar! 🚀**



