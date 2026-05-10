---
name: Hot Wheels Advanced Features Implementation
overview: Hot Wheels koleksiyon yönetim sistemine gelişmiş fiyat takibi, çoklu koleksiyon yönetimi, AI/otomasyon, gelişmiş analitik, özelleştirilebilir dashboard, veri yönetimi, API entegrasyonları, oyunlaştırma geliştirmeleri ve çoklu dil desteği eklenmesi.
todos:
  - id: stage4-ai-automation
    content: AI ve Otomasyon - Model tanıma, kategorizasyon, fiyat tahmini, chatbot
    status: completed
  - id: stage4-customizable-dashboard
    content: Özelleştirilebilir Dashboard - Drag & drop widget sistemi, widget kütüphanesi
    status: completed
  - id: stage4-multi-collection
    content: Koleksiyon Yönetimi - Authentication, çoklu koleksiyon, senkronizasyon
    status: completed
  - id: stage4-price-tracking
    content: Gelişmiş Fiyat Takibi - Otomatik güncellemeler, trend analizi, uyarılar
    status: completed
  - id: stage4-advanced-analytics
    content: İstatistik ve Analitik - Gelişmiş grafikler, yatırım analizi, tahminler
    status: completed
  - id: stage4-data-management
    content: Veri Yönetimi - Otomatik yedekleme, doğrulama, temizleme
    status: completed
  - id: stage4-api-calendar
    content: Hot Wheels API ve Takvim - Resmi API, takvim entegrasyonu
    status: completed
  - id: stage4-gamification-enhancements
    content: Oyunlaştırma Geliştirmeleri - Sezonluk etkinlikler, yarışmalar, rozetler
    status: completed
  - id: stage4-i18n
    content: Çoklu Dil Desteği - Türkçe, İngilizce dil desteği
    status: completed
---

# Hot Wheels Gelişmiş Özellikler Planı

## AŞAMA 4: Gelişmiş Özellikler

### 4.1 Gelişmiş Fiyat Takibi

**Amaç:** Otomatik fiyat güncellemeleri, trend analizi ve akıllı fiyat uyarıları

**Dosyalar:**

- `src/features/pricing/price-tracking.service.ts` (YENİ)
- `src/features/pricing/price-alert.service.ts` (YENİ)
- `src/components/PriceTrendChart.tsx` (YENİ)
- `src/components/PriceAlertDialog.tsx` (YENİ)
- `src/app/api/pricing/track/route.ts` (YENİ)
- `src/app/api/pricing/alerts/route.ts` (YENİ)
- `prisma/schema.prisma` (PriceAlert modeli eklenecek)

**Özellikler:**

- Otomatik fiyat güncellemeleri (eBay, Marketplace scraping)
- Fiyat trend analizi (grafikler, tahminler)
- Fiyat uyarıları (hedef fiyata düştüğünde bildirim)
- Piyasa analizi (ortalama, en yüksek/düşük, trend)
- Fiyat karşılaştırması (farklı kaynaklar)

**Veritabanı Değişikliği:**

```prisma
model PriceAlert {
  id          Int      @id @default(autoincrement())
  userId      String?
  variantId   Int?
  modelId     Int?
  targetPrice Float
  condition   String   // "below", "above", "equal"
  active      Boolean  @default(true)
  notified    Boolean  @default(false)
  createdAt   DateTime @default(now())
  triggeredAt DateTime?
}
```

---

### 4.2 Koleksiyon Yönetimi

**Amaç:** Çoklu koleksiyon desteği, senkronizasyon ve gelişmiş yönetim

**Dosyalar:**

- `src/features/auth/auth.service.ts` (YENİ)
- `src/features/collections/multi-collection.service.ts` (YENİ)
- `src/components/MultiCollectionSelector.tsx` (YENİ)
- `src/components/CollectionSyncDialog.tsx` (YENİ)
- `src/app/api/auth/route.ts` (YENİ)
- `src/app/api/collections/sync/route.ts` (YENİ)
- `prisma/schema.prisma` (User, UserCollection modelleri eklenecek)

**Özellikler:**

- Kullanıcı sistemi (authentication)
- Çoklu koleksiyon desteği (farklı kullanıcılar, farklı koleksiyonlar)
- Koleksiyon senkronizasyonu (bulut yedekleme)
- Toplu işlemler (çoklu seçim, toplu güncelleme)
- Koleksiyon geçmişi (değişiklik logları, versiyon kontrolü)

**Veritabanı Değişikliği:**

```prisma
model User {
  id            Int      @id @default(autoincrement())
  email         String   @unique
  name          String?
  passwordHash  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  collections   UserCollection[]
  achievements  UserAchievement[]
  goals         Goal[]
  shareLinks    ShareLink[]
}

model UserCollection {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  collectionId Int
  collection  Collection @relation(fields: [collectionId], references: [id])
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

---

### 4.3 AI ve Otomasyon (ÖNCELİKLİ)

**Amaç:** AI destekli otomatik model tanıma, kategorizasyon ve akıllı öneriler

**Dosyalar:**

- `src/features/ai/image-recognition.service.ts` (YENİ)
- `src/features/ai/auto-categorization.service.ts` (YENİ)
- `src/features/ai/price-prediction.service.ts` (YENİ)
- `src/features/ai/chatbot.service.ts` (YENİ)
- `src/components/AIImageUpload.tsx` (YENİ)
- `src/components/AIChatbot.tsx` (YENİ)
- `src/components/PricePredictionChart.tsx` (YENİ)
- `src/app/api/ai/recognize/route.ts` (YENİ)
- `src/app/api/ai/categorize/route.ts` (YENİ)
- `src/app/api/ai/predict-price/route.ts` (YENİ)
- `src/app/api/ai/chat/route.ts` (YENİ)

**Özellikler:**

- **Otomatik Model Tanıma:** Fotoğraftan model tanıma (Google Vision API, Custom ML model)
- **Akıllı Kategorizasyon:** AI ile otomatik etiketleme ve kategorizasyon
- **Fiyat Tahmin Motoru:** Geçmiş verilere dayalı değer artış tahminleri
- **AI Chatbot:** Koleksiyon hakkında sorular, öneriler, yardım
- **Görsel Analiz:** Model durumu, hasar tespiti, otantiklik kontrolü
- **Otomatik Veri Doldurma:** Model bilgilerini otomatik tamamlama

**AI Teknolojileri:**

- Google Vision API (görsel tanıma)
- OpenAI GPT-4 (chatbot, öneriler)
- Custom TensorFlow model (model tanıma)
- Regression models (fiyat tahmini)

---

### 4.4 İstatistik ve Analitik

**Amaç:** Gelişmiş grafikler, tahminler ve yatırım analizi

**Dosyalar:**

- `src/features/analytics/advanced-stats.service.ts` (YENİ)
- `src/features/analytics/investment-analysis.service.ts` (YENİ)
- `src/components/charts/HeatmapChart.tsx` (YENİ)
- `src/components/charts/TimelineChart.tsx` (GELİŞTİRİLECEK)
- `src/components/InvestmentAnalysis.tsx` (YENİ)
- `src/components/CompletionRate.tsx` (YENİ)
- `src/app/analytics/page.tsx` (YENİ)

**Özellikler:**

- Gelişmiş grafikler (heatmap, timeline, dağılım)
- Koleksiyon değer tahmini (gelecek değer tahmini)
- Tamamlanma oranı (koleksiyon tamamlanma yüzdesi)
- Yatırım analizi (ROI, kar/zarar hesaplama)
- Trend analizi (zaman içinde değişim)
- Karşılaştırmalı analiz (yıllar, koleksiyonlar)

---

### 4.5 Özelleştirilebilir Dashboard

**Amaç:** Kullanıcıların kendi dashboard'larını oluşturması ve düzenlemesi

**Dosyalar:**

- `src/features/dashboard/widget.service.ts` (YENİ)
- `src/features/dashboard/layout.service.ts` (YENİ)
- `src/components/dashboard/WidgetGrid.tsx` (YENİ)
- `src/components/dashboard/WidgetEditor.tsx` (YENİ)
- `src/components/dashboard/widgets/StatsWidget.tsx` (YENİ)
- `src/components/dashboard/widgets/ChartWidget.tsx` (YENİ)
- `src/components/dashboard/widgets/CollectionWidget.tsx` (YENİ)
- `src/components/dashboard/widgets/GoalWidget.tsx` (YENİ)
- `src/components/dashboard/widgets/AchievementWidget.tsx` (YENİ)
- `src/app/api/dashboard/widgets/route.ts` (YENİ)
- `prisma/schema.prisma` (DashboardLayout, DashboardWidget modelleri)

**Özellikler:**

- Drag & drop widget düzenleme
- Widget kütüphanesi (istatistikler, grafikler, koleksiyonlar, hedefler, başarımlar)
- Özelleştirilebilir widget boyutları (1x1, 2x1, 2x2, vb.)
- Widget ayarları (filtreler, renkler, veri kaynakları)
- Dashboard şablonları (önceden tanımlı düzenler)
- Responsive widget yerleşimi

**Widget Tipleri:**

- İstatistik kartları (toplam model, varyant, değer)
- Grafik widget'ları (pie, bar, line charts)
- Koleksiyon özeti
- Hedef ilerlemesi
- Başarım rozetleri
- Son eklenenler
- Fiyat trendleri

**Veritabanı Değişikliği:**

```prisma
model DashboardLayout {
  id          Int      @id @default(autoincrement())
  userId      String?
  name        String
  isDefault   Boolean  @default(false)
  widgets     DashboardWidget[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model DashboardWidget {
  id          Int      @id @default(autoincrement())
  layoutId    Int
  layout      DashboardLayout @relation(fields: [layoutId], references: [id])
  type        String   // "stats", "chart", "collection", "goal", "achievement"
  position    Int      // Grid position
  size        String   // "1x1", "2x1", "2x2"
  config      String   // JSON string - widget configuration
  createdAt   DateTime @default(now())
}
```

---

### 4.6 Veri Yönetimi

**Amaç:** Otomatik yedekleme, veri doğrulama ve temizleme

**Dosyalar:**

- `src/features/data/backup-auto.service.ts` (YENİ)
- `src/features/data/validation.service.ts` (YENİ)
- `src/features/data/cleanup.service.ts` (YENİ)
- `src/components/DataValidationPanel.tsx` (YENİ)
- `src/components/DuplicateDetector.tsx` (YENİ)
- `src/app/api/data/validate/route.ts` (YENİ)
- `src/app/api/data/cleanup/route.ts` (YENİ)
- `scripts/tools/auto-backup.ts` (YENİ)

**Özellikler:**

- Otomatik yedekleme (periyodik yedekleme, zamanlanmış görevler)
- Veri doğrulama (tutarsızlık kontrolü, eksik veri tespiti)
- Toplu import (Excel/CSV toplu import, mapping)
- Veri temizleme (duplicate detection, merge, deduplication)
- Veri geçmişi (değişiklik logları, audit trail)

---

### 4.7 Hot Wheels Resmi API ve Takvim Entegrasyonu

**Amaç:** Resmi veri kaynakları ve etkinlik takibi

**Dosyalar:**

- `src/lib/api/hotwheels-official.ts` (YENİ)
- `src/features/calendar/calendar.service.ts` (YENİ)
- `src/components/CalendarIntegration.tsx` (YENİ)
- `src/components/ReleaseCalendar.tsx` (YENİ)
- `src/app/api/calendar/sync/route.ts` (YENİ)
- `src/app/api/hotwheels/fetch/route.ts` (YENİ)
- `prisma/schema.prisma` (CalendarEvent, ReleaseDate modelleri)

**Özellikler:**

- Hot Wheels resmi API entegrasyonu (eğer mevcut) veya scraping
- Takvim entegrasyonu (Google Calendar, Outlook, iCal)
- Yeni seri çıkış tarihleri
- Etkinlik takibi (fuarlar, yarışmalar)
- Hatırlatıcılar (yeni seri, özel etkinlikler)

**Veritabanı Değişikliği:**

```prisma
model CalendarEvent {
  id          Int      @id @default(autoincrement())
  userId      String?
  title       String
  description String?
  startDate   DateTime
  endDate     DateTime?
  type        String   // "release", "event", "reminder"
  collectionId Int?
  collection  Collection? @relation(fields: [collectionId], references: [id])
  calendarId  String?  // External calendar ID
  synced      Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model ReleaseDate {
  id          Int      @id @default(autoincrement())
  collectionId Int
  collection  Collection @relation(fields: [collectionId], references: [id])
  releaseDate DateTime
  region      String?  // "US", "EU", "Global"
  source      String   // "official", "wiki", "manual"
  createdAt   DateTime @default(now())
}
```

---

### 4.8 Oyunlaştırma Geliştirmeleri

**Amaç:** Sezonluk etkinlikler, yarışmalar ve rozet sistemi

**Dosyalar:**

- `src/features/gamification/seasonal-events.service.ts` (YENİ)
- `src/features/gamification/competitions.service.ts` (YENİ)
- `src/components/SeasonalEventCard.tsx` (YENİ)
- `src/components/CompetitionLeaderboard.tsx` (YENİ)
- `src/components/BadgeCollection.tsx` (YENİ)
- `src/app/competitions/page.tsx` (YENİ)
- `prisma/schema.prisma` (SeasonalEvent, Competition, CompetitionEntry modelleri)

**Özellikler:**

- Sezonluk etkinlikler (özel achievement'lar, sınırlı süreli rozetler)
- Koleksiyon yarışmaları (diğer kullanıcılarla yarışma, sıralama)
- Rozet sistemi (özel rozetler, koleksiyon rozetleri)
- Seviye sistemi (koleksiyon seviyesi, XP sistemi)
- Günlük görevler (daily quests, challenges)

**Veritabanı Değişikliği:**

```prisma
model SeasonalEvent {
  id          Int      @id @default(autoincrement())
  name        String
  description String
  startDate   DateTime
  endDate     DateTime
  achievements Int[]   // Achievement IDs
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Competition {
  id          Int      @id @default(autoincrement())
  name        String
  description String
  type        String   // "collection_count", "value", "completion"
  startDate   DateTime
  endDate     DateTime
  prize       String?
  entries     CompetitionEntry[]
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model CompetitionEntry {
  id            Int      @id @default(autoincrement())
  competitionId Int
  competition   Competition @relation(fields: [competitionId], references: [id])
  userId        String?
  score         Float
  rank          Int?
  createdAt     DateTime @default(now())
}
```

---

### 4.9 Çoklu Dil Desteği

**Amaç:** Uygulamanın farklı dillerde kullanılabilmesi

**Dosyalar:**

- `src/lib/i18n/config.ts` (YENİ)
- `src/lib/i18n/locales/tr.json` (YENİ)
- `src/lib/i18n/locales/en.json` (YENİ)
- `src/components/LanguageSelector.tsx` (YENİ)
- `src/app/api/i18n/route.ts` (YENİ)
- `next.config.ts` (i18n config eklenecek)

**Özellikler:**

- Kullanıcı arayüzünün birden fazla dilde sunulması (Türkçe, İngilizce)
- Dil tercihlerinin kullanıcı bazında ayarlanabilmesi
- Dil değişikliklerinin anında uygulanması
- Tarih/sayı formatlarının dile göre ayarlanması

**Desteklenen Diller:**

- Türkçe (tr)
- İngilizce (en)
- (İleride genişletilebilir: Almanca, Fransızca, vb.)

---

## Uygulama Sırası ve Onay Süreci

**ÖNEMLİ:** Her aşama başlamadan önce kullanıcıdan onay alınacaktır. Her aşama tamamlandıktan sonra bir sonraki aşamaya geçmeden önce kullanıcı onayı beklenir.

### AŞAMA 1: 4.3 AI ve Otomasyon (ÖNCELİKLİ)

**Durum:** Beklemede - Kullanıcı onayı bekleniyor

**Öncelik:** Yüksek (Kullanıcının en çok istediği özellik)

**Tahmini Süre:** 3-4 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. AI servis yapısını oluştur (image-recognition, auto-categorization, price-prediction, chatbot)
2. Google Vision API entegrasyonu (görsel tanıma)
3. OpenAI GPT-4 entegrasyonu (chatbot, öneriler)
4. Fiyat tahmin modeli (regression)
5. UI component'leri (AIImageUpload, AIChatbot, PricePredictionChart)
6. API route'ları oluştur
7. Test ve optimizasyon

**Onay Noktası:** Tüm AI özellikleri tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 2: 4.5 Özelleştirilebilir Dashboard

**Durum:** Beklemede - Aşama 1 onayından sonra başlayacak

**Öncelik:** Yüksek (Kullanıcı deneyimi için kritik)

**Tahmini Süre:** 2-3 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Dashboard layout servisleri oluştur
2. Widget sistemi tasarla (drag & drop)
3. Widget kütüphanesi (stats, chart, collection, goal, achievement)
4. Widget editor component'i
5. Dashboard şablonları
6. Responsive yerleşim
7. Veritabanı modelleri (DashboardLayout, DashboardWidget)

**Onay Noktası:** Dashboard özelleştirme sistemi tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 3: 4.2 Koleksiyon Yönetimi

**Durum:** Beklemede - Aşama 2 onayından sonra başlayacak

**Öncelik:** Yüksek (Diğer özellikler için temel)

**Tahmini Süre:** 2-3 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Authentication sistemi (User model, login/register)
2. Çoklu koleksiyon desteği (UserCollection model)
3. Koleksiyon senkronizasyonu (bulut yedekleme)
4. Toplu işlemler (çoklu seçim, toplu güncelleme)
5. Koleksiyon geçmişi (değişiklik logları)
6. UI component'leri (MultiCollectionSelector, CollectionSyncDialog)

**Onay Noktası:** Authentication ve çoklu koleksiyon sistemi tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 4: 4.1 Gelişmiş Fiyat Takibi

**Durum:** Beklemede - Aşama 3 onayından sonra başlayacak

**Öncelik:** Orta

**Tahmini Süre:** 2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Fiyat tracking servisleri (otomatik güncellemeler)
2. eBay/Marketplace scraping
3. Fiyat trend analizi (grafikler, tahminler)
4. Fiyat uyarı sistemi (PriceAlert model)
5. Piyasa analizi (ortalama, min/max, trend)
6. UI component'leri (PriceTrendChart, PriceAlertDialog)

**Onay Noktası:** Fiyat takip sistemi tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 5: 4.4 İstatistik ve Analitik

**Durum:** Beklemede - Aşama 4 onayından sonra başlayacak

**Öncelik:** Orta

**Tahmini Süre:** 2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Gelişmiş istatistik servisleri
2. Yatırım analizi (ROI, kar/zarar)
3. Gelişmiş grafikler (heatmap, timeline)
4. Koleksiyon değer tahmini
5. Tamamlanma oranı hesaplama
6. UI component'leri (InvestmentAnalysis, CompletionRate, HeatmapChart)

**Onay Noktası:** İstatistik ve analitik özellikleri tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 6: 4.6 Veri Yönetimi

**Durum:** Beklemede - Aşama 5 onayından sonra başlayacak

**Öncelik:** Orta

**Tahmini Süre:** 1-2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Otomatik yedekleme sistemi (zamanlanmış görevler)
2. Veri doğrulama servisleri (tutarsızlık kontrolü)
3. Toplu import geliştirmeleri (Excel/CSV mapping)
4. Veri temizleme (duplicate detection, merge)
5. Veri geçmişi (audit trail)
6. UI component'leri (DataValidationPanel, DuplicateDetector)

**Onay Noktası:** Veri yönetim özellikleri tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 7: 4.7 Hot Wheels API ve Takvim

**Durum:** Beklemede - Aşama 6 onayından sonra başlayacak

**Öncelik:** Orta

**Tahmini Süre:** 2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Hot Wheels resmi API entegrasyonu (veya scraping)
2. Takvim entegrasyonu (Google Calendar, Outlook, iCal)
3. Yeni seri çıkış tarihleri takibi
4. Etkinlik takibi (fuarlar, yarışmalar)
5. Hatırlatıcı sistemi
6. Veritabanı modelleri (CalendarEvent, ReleaseDate)
7. UI component'leri (CalendarIntegration, ReleaseCalendar)

**Onay Noktası:** API ve takvim entegrasyonları tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 8: 4.8 Oyunlaştırma Geliştirmeleri

**Durum:** Beklemede - Aşama 7 onayından sonra başlayacak

**Öncelik:** Düşük

**Tahmini Süre:** 2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. Sezonluk etkinlik sistemi (SeasonalEvent model)
2. Koleksiyon yarışmaları (Competition, CompetitionEntry modelleri)
3. Rozet sistemi geliştirmeleri
4. Seviye sistemi (XP, leveling)
5. Günlük görevler (daily quests)
6. UI component'leri (SeasonalEventCard, CompetitionLeaderboard, BadgeCollection)

**Onay Noktası:** Oyunlaştırma geliştirmeleri tamamlandıktan sonra kullanıcıdan onay alınacak.

---

### AŞAMA 9: 4.9 Çoklu Dil Desteği

**Durum:** Beklemede - Aşama 8 onayından sonra başlayacak

**Öncelik:** Düşük

**Tahmini Süre:** 1-2 gün

**Onay:** ❌ Henüz onaylanmadı

**Alt Görevler:**

1. i18n yapılandırması (next-intl veya react-i18next)
2. Dil dosyaları oluştur (tr.json, en.json)
3. Tüm UI metinlerini çevir
4. Dil seçici component (LanguageSelector)
5. Tarih/sayı formatlarını dile göre ayarla
6. Next.js i18n config

**Onay Noktası:** Çoklu dil desteği tamamlandıktan sonra kullanıcıdan onay alınacak.

---

## Onay Süreci Detayları

Her aşama için aşağıdaki süreç takip edilecek:

1. **Planlama:** Aşama detayları, dosyalar ve alt görevler belirlenir
2. **Onay İsteği:** Kullanıcıdan aşamaya başlama onayı istenir (örnek: "AŞAMA 1: AI ve Otomasyon'a başlamak için onayınızı bekliyorum")
3. **Backup:** Onay sonrası otomatik backup alınır (`npm run backup:create`)
4. **Geliştirme:** Aşama özellikleri implement edilir (alt görevler sırayla tamamlanır)
5. **Test:** Build ve temel testler yapılır (`npm run build`)
6. **Tamamlama Raporu:** Aşama tamamlandığında detaylı rapor sunulur
7. **Sonraki Aşama Onayı:** Bir sonraki aşamaya geçmeden önce kullanıcı onayı beklenir

**Onay Formatı:**

- Her aşama başlamadan önce: "AŞAMA X: [Özellik Adı]'na başlamak için onayınızı bekliyorum. Devam edeyim mi?"
- Her aşama tamamlandıktan sonra: "AŞAMA X tamamlandı. Özet: [özet]. Bir sonraki aşamaya (AŞAMA Y) geçmek için onayınızı bekliyorum."

---

## Teknik Notlar

- Her özellik için ayrı migration dosyası oluşturulacak
- API key'ler environment variables'da saklanacak
- AI servisleri için rate limiting uygulanacak
- Dashboard widget'ları için drag & drop kütüphanesi: `@dnd-kit/core`
- i18n için `next-intl` veya `react-i18next` kullanılacak
- Takvim entegrasyonu için `googleapis` ve `node-ical` kullanılacak