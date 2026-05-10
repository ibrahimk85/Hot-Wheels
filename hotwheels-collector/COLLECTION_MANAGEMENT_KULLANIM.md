# Koleksiyon Yönetimi Kullanım Kılavuzu

## 📍 Genel Bakış

AŞAMA 3'te eklenen Koleksiyon Yönetimi özellikleri:
- **Authentication Sistemi**: Kullanıcı kaydı ve girişi
- **Çoklu Koleksiyon Desteği**: Birden fazla koleksiyon yönetimi
- **Koleksiyon Senkronizasyonu**: Export/Import özellikleri
- **Koleksiyon Geçmişi**: Değişiklik logları

---

## 🔐 1. Authentication (Kullanıcı Sistemi)

### Kullanıcı Kaydı (Register)

**API Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "kullanici@example.com",
  "name": "Kullanıcı Adı",
  "password": "güvenlişifre123"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "kullanici@example.com",
    "name": "Kullanıcı Adı"
  }
}
```

**Örnek Kullanım (JavaScript/Fetch):**
```javascript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'kullanici@example.com',
    name: 'Kullanıcı Adı',
    password: 'güvenlişifre123'
  })
});

const data = await response.json();
console.log(data);
```

**Kurallar:**
- Email formatı geçerli olmalı
- Şifre en az 6 karakter olmalı
- Email benzersiz olmalı (zaten kayıtlı email kullanılamaz)

---

### Kullanıcı Girişi (Login)

**API Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "kullanici@example.com",
  "password": "güvenlişifre123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "kullanici@example.com",
    "name": "Kullanıcı Adı"
  }
}
```

**Örnek Kullanım:**
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'kullanici@example.com',
    password: 'güvenlişifre123'
  })
});

const data = await response.json();
if (data.user) {
  // Giriş başarılı - user bilgisini sakla
  localStorage.setItem('userId', data.user.id);
  localStorage.setItem('userEmail', data.user.email);
}
```

**Hata Durumları:**
- `400`: Email veya şifre eksik
- `401`: Geçersiz email veya şifre
- `500`: Sunucu hatası

---

## 📦 2. Çoklu Koleksiyon Yönetimi

### Kullanıcının Koleksiyonlarını Listeleme

**API Endpoint:** `GET /api/collections/user?userId={userId}`

**Örnek:**
```javascript
const userId = 1;
const response = await fetch(`/api/collections/user?userId=${userId}`);
const collections = await response.json();

console.log(collections);
// [
//   {
//     id: 1,
//     userId: 1,
//     collectionId: 5,
//     isDefault: true,
//     collection: {
//       id: 5,
//       name: "Mainline",
//       code: "HW Mainline",
//       year: { id: 1, year: 2024 }
//     }
//   },
//   ...
// ]
```

---

### Kullanıcıya Koleksiyon Ekleme

**API Endpoint:** `POST /api/collections/user`

**Request Body:**
```json
{
  "userId": 1,
  "collectionId": 5,
  "isDefault": false
}
```

**Örnek:**
```javascript
const response = await fetch('/api/collections/user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 1,
    collectionId: 5,
    isDefault: false
  })
});

const userCollection = await response.json();
```

**Not:** Eğer `isDefault: true` ise, kullanıcının diğer tüm koleksiyonları varsayılan olmaktan çıkarılır.

---

### Kullanıcıdan Koleksiyon Kaldırma

**API Endpoint:** `DELETE /api/collections/user?userId={userId}&collectionId={collectionId}`

**Örnek:**
```javascript
const userId = 1;
const collectionId = 5;

const response = await fetch(
  `/api/collections/user?userId=${userId}&collectionId=${collectionId}`,
  { method: 'DELETE' }
);

const result = await response.json();
```

---

### Varsayılan Koleksiyon Ayarlama

**API Endpoint:** `PUT /api/collections/user/default`

**Request Body:**
```json
{
  "userId": 1,
  "collectionId": 5
}
```

**Örnek:**
```javascript
const response = await fetch('/api/collections/user/default', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 1,
    collectionId: 5
  })
});
```

---

## 🔄 3. Koleksiyon Senkronizasyonu

### Koleksiyon Export (Dışa Aktarma)

**API Endpoint:** `GET /api/collections/sync?userId={userId}`

**Örnek:**
```javascript
const userId = 1;
const response = await fetch(`/api/collections/sync?userId=${userId}`);
const exportData = await response.json();

// JSON dosyası olarak indir
const blob = new Blob([JSON.stringify(exportData, null, 2)], {
  type: 'application/json'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `collection-backup-${Date.now()}.json`;
a.click();
```

**Export Verisi Yapısı:**
```json
{
  "userCollections": [...],
  "models": [
    {
      "id": 1,
      "castingName": "Model Adı",
      "variants": [...],
      "images": [...],
      "subSeries": {...}
    }
  ],
  "exportedAt": "2025-12-07T13:00:00.000Z"
}
```

---

### Koleksiyon Import (İçe Aktarma)

**API Endpoint:** `POST /api/collections/sync`

**Request Body:**
```json
{
  "userId": 1,
  "data": {
    "userCollections": [...],
    "models": [...]
  }
}
```

**Not:** Import özelliği şu anda placeholder durumunda. Gerçek import işlevselliği gelecek güncellemelerde eklenecek.

---

## 📊 4. Koleksiyon Geçmişi

Koleksiyon geçmişi otomatik olarak kaydedilir. Şu anda API endpoint'i yok, ancak servis fonksiyonları mevcut:

```typescript
import { logCollectionHistory, getCollectionHistory } from '@/features/collections/multi-collection.service';

// Geçmiş kaydet
await logCollectionHistory(userId, {
  collectionId: 5,
  action: 'add_model',
  entityType: 'model',
  entityId: 10,
  changes: { modelName: 'Yeni Model' }
});

// Geçmişi getir
const history = await getCollectionHistory(userId, 50);
```

---

## 🎨 5. UI Component Kullanımı

### MultiCollectionSelector Component

**Kullanım:**
```tsx
import { MultiCollectionSelector } from '@/components/MultiCollectionSelector';

function MyPage() {
  const userId = 1; // Kullanıcı ID'si
  const [selectedCollectionId, setSelectedCollectionId] = useState<number>();

  return (
    <MultiCollectionSelector
      userId={userId}
      selectedCollectionId={selectedCollectionId}
      onCollectionChange={(collectionId) => {
        setSelectedCollectionId(collectionId);
      }}
    />
  );
}
```

**Özellikler:**
- Kullanıcının koleksiyonlarını listeler
- Yeni koleksiyon ekleme dialog'u
- Koleksiyon kaldırma
- Varsayılan koleksiyon ayarlama
- Dropdown ile koleksiyon seçimi

---

## 📝 6. Pratik Örnekler

### Örnek 1: Yeni Kullanıcı Kaydı ve İlk Koleksiyon Ekleme

```javascript
// 1. Kullanıcı kaydı
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'yeni@example.com',
    name: 'Yeni Kullanıcı',
    password: 'şifre123'
  })
});

const { user } = await registerResponse.json();
const userId = user.id;

// 2. İlk koleksiyonu ekle (varsayılan olarak)
const addCollectionResponse = await fetch('/api/collections/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: userId,
    collectionId: 1, // İstediğiniz koleksiyon ID'si
    isDefault: true
  })
});
```

### Örnek 2: Kullanıcının Tüm Koleksiyonlarını Listeleme

```javascript
const userId = 1;

const response = await fetch(`/api/collections/user?userId=${userId}`);
const userCollections = await response.json();

userCollections.forEach((uc) => {
  console.log(`${uc.collection.name} (${uc.collection.year.year})`);
  if (uc.isDefault) {
    console.log('  → Varsayılan koleksiyon');
  }
});
```

### Örnek 3: Koleksiyon Yedekleme

```javascript
const userId = 1;

// Export
const response = await fetch(`/api/collections/sync?userId=${userId}`);
const data = await response.json();

// LocalStorage'a kaydet
localStorage.setItem('collectionBackup', JSON.stringify(data));

// Veya dosya olarak indir
const blob = new Blob([JSON.stringify(data, null, 2)], {
  type: 'application/json'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `backup-${new Date().toISOString()}.json`;
a.click();
```

---

## ⚠️ 7. Önemli Notlar

1. **Session Yönetimi**: Şu anda basit bir authentication sistemi var. Gerçek uygulamada JWT token veya NextAuth kullanılmalı.

2. **Güvenlik**: 
   - Şifreler bcrypt ile hash'leniyor
   - API endpoint'leri şu anda herkese açık (gelecekte middleware ile korunmalı)

3. **Kullanıcı ID**: Şu anda kullanıcı ID'si manuel olarak geçirilmeli. Gerçek uygulamada session'dan alınmalı.

4. **Import Özelliği**: Import özelliği şu anda placeholder. Gerçek import işlevselliği eklenecek.

---

## 🔮 8. Gelecek Geliştirmeler

- [ ] Session yönetimi (JWT/NextAuth)
- [ ] API endpoint'lerine authentication middleware
- [ ] Tam import işlevselliği
- [ ] Koleksiyon geçmişi API endpoint'i
- [ ] Toplu işlemler UI component'leri
- [ ] Koleksiyon karşılaştırma özelliği

---

**İyi kullanımlar! 🚀**



