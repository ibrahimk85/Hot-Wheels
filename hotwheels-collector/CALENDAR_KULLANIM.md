# Takvim ve Çıkış Tarihleri Kullanım Kılavuzu

## Genel Bakış

Takvim ve Çıkış Tarihleri özelliği, yeni seri çıkış tarihlerini takip etmenize ve özel etkinlikleri (fuarlar, yarışmalar) yönetmenize olanak sağlar.

## Erişim

1. Ana menüden **"Takvim"** linkine tıklayın
2. Veya doğrudan `/calendar` adresine gidin

## Özellikler

### 1. Release Calendar (Çıkış Takvimi)

Yeni seri çıkış tarihlerini takip edin ve görselleştirin.

#### Release Date Ekleme

1. "Yeni Release Date Ekle" butonuna tıklayın
2. Formu doldurun:
   - **Çıkış Tarihi:** Serinin çıkış tarihi
   - **Bölge:** ABD, Avrupa, Global, Türkiye
   - **Kaynak:** Resmi, Wiki, Topluluk, Manuel
   - **Notlar:** Ek bilgiler
3. "Ekle" butonuna tıklayın

#### Takvim Görünümü

- Takvim üzerinde release date'leri görselleştirin
- Release date olan günler mavi renkle işaretlenir
- Bir tarihe tıklayarak o gündeki release date'leri görüntüleyin

#### Release Date Bilgileri

Her release date için:
- Koleksiyon/Alt Seri/Model adı
- Yıl bilgisi
- Bölge bilgisi
- Onay durumu (Onaylandı/Onaylanmadı)
- Notlar

### 2. Calendar Integration (Takvim Entegrasyonu)

Fuarlar, yarışmalar ve özel etkinlikleri yönetin.

#### Etkinlik Ekleme

1. "Yeni Etkinlik" butonuna tıklayın
2. Formu doldurun:
   - **Başlık:** Etkinlik adı
   - **Açıklama:** Detaylı bilgi
   - **Etkinlik Türü:** Çıkış, Fuar, Yarışma, Özel
   - **Başlangıç Tarihi ve Saati:** Etkinliğin başlangıcı
   - **Bitiş Tarihi ve Saati:** (Opsiyonel) Etkinliğin bitişi
   - **Konum:** Etkinlik yeri
   - **URL:** İlgili web sitesi
   - **Hatırlatıcı:** Etkinlikten kaç gün önce hatırlatılacak
3. "Ekle" butonuna tıklayın

#### Yaklaşan Etkinlikler

- Yaklaşan etkinlikler otomatik olarak listelenir
- Her etkinlik için:
  - Başlık ve açıklama
  - Tarih ve saat
  - Konum bilgisi
  - Hatırlatıcı durumu
  - URL linki (varsa)
  - iCal export butonu

#### iCal Export

Etkinlikleri iCal formatında (.ics) dışa aktarın:
1. Etkinlik kartındaki "iCal" butonuna tıklayın
2. Dosya otomatik olarak indirilir
3. Google Calendar, Outlook veya diğer takvim uygulamalarına import edebilirsiniz

### 3. Hatırlatıcı Sistemi

Etkinlikler için hatırlatıcılar ayarlayın:
- Hatırlatıcı aktif edildiğinde, belirtilen gün sayısı öncesinde bildirim gösterilir
- Hatırlatıcı gün sayısı: 1-30 gün arası ayarlanabilir

### 4. Google Calendar Entegrasyonu (Gelecek Özellik)

Google Calendar ile senkronizasyon:
- Etkinlikleri Google Calendar'a otomatik ekleme
- Google Calendar'dan etkinlikleri çekme
- İki yönlü senkronizasyon

**Not:** Bu özellik için Google OAuth kurulumu gereklidir.

## API Endpoints

### Release Dates

```
GET /api/calendar/releases
GET /api/calendar/releases?upcoming=true&days=30
POST /api/calendar/releases
PUT /api/calendar/release-dates/[id]
DELETE /api/calendar/release-dates/[id]
```

### Calendar Events

```
GET /api/calendar/events
GET /api/calendar/events?upcoming=true&days=30
POST /api/calendar/events
PUT /api/calendar/events/[id]
DELETE /api/calendar/events/[id]
GET /api/calendar/events/[id]/ical
```

### iCal Export

```
GET /api/calendar/export/ical?userId=1&startDate=2025-01-01&endDate=2025-12-31
```

## Teknik Detaylar

### Release Date Kaynakları

- **Resmi:** Hot Wheels resmi kaynaklarından
- **Wiki:** Hot Wheels Wiki'den
- **Topluluk:** Topluluk paylaşımlarından
- **Manuel:** Kullanıcı tarafından manuel eklenen

### Etkinlik Türleri

- **Çıkış:** Yeni seri çıkış tarihleri
- **Fuar:** Hot Wheels fuarları ve etkinlikleri
- **Yarışma:** Yarışma ve yarışmalar
- **Özel:** Kullanıcı tanımlı özel etkinlikler

### iCal Formatı

iCal (.ics) dosyaları standart takvim formatıdır ve şu uygulamalarla uyumludur:
- Google Calendar
- Apple Calendar
- Microsoft Outlook
- Thunderbird
- Diğer iCal uyumlu uygulamalar

## Sorun Giderme

### Release date görünmüyor

1. Tarihin doğru seçildiğinden emin olun
2. Takvimde mavi işaretli günlere tıklayın
3. API endpoint'lerinin çalıştığından emin olun

### iCal export çalışmıyor

1. Tarayıcı konsolunu kontrol edin (F12)
2. Dosya indirme izinlerini kontrol edin
3. API endpoint'in çalıştığından emin olun

### Hatırlatıcı çalışmıyor

1. Hatırlatıcının aktif olduğundan emin olun
2. Hatırlatıcı gün sayısının doğru ayarlandığından emin olun
3. Etkinlik tarihinin gelecekte olduğundan emin olun

## Notlar

- Release date'ler koleksiyon, alt seri veya model seviyesinde eklenebilir
- Etkinlikler kullanıcı bazlıdır (multi-user desteği için)
- iCal export, tüm etkinlikleri tek bir dosyada birleştirebilir
- Google Calendar entegrasyonu için OAuth kurulumu gereklidir (gelecek özellik)



