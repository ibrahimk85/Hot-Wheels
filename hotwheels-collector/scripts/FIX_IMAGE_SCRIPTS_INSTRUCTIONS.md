# Resim Script Hatalarını Düzeltme - Talimatlar

## ❌ Hatalar

Resim scriptlerinde 3 hata var:

1. **Satır 106**: `table.find()` → `$(table).find()` olmalı
2. **Satır 106**: Filter parametrelerinde tip eksik
3. **Satır 210 ve 264**: URL constructor hatası

## ✅ Çözüm

### Yöntem 1: Python Script (Önerilen)

```bash
cd C:\Hot_Wheels\hotwheels-collector
python scripts/fix_all_image_scripts_complete.py
```

### Yöntem 2: PowerShell Script

```powershell
cd C:\Hot_Wheels\hotwheels-collector
powershell -ExecutionPolicy Bypass -File scripts/fix_all_image_scripts_final.ps1
```

### Yöntem 3: Manuel Düzeltme

Her dosyada (`scripts/tools/download_and_sync_images_*_boulevard.ts`) şu 3 değişikliği yapın:

#### Değişiklik 1 (Satır ~106):
```typescript
// ÖNCE:
const rows = table.find('tbody tr').filter((_, row) => {

// SONRA:
const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
```

#### Değişiklik 2 (Satır ~210):
```typescript
// ÖNCE:
const urlObj = new URL(fullCardedUrl);

// SONRA:
const urlObj = new URL(fullCardedUrl as string);
```

#### Değişiklik 3 (Satır ~264):
```typescript
// ÖNCE:
const urlObj = new URL(fullLooseUrl);

// SONRA:
const urlObj = new URL(fullLooseUrl as string);
```

## 📝 Not

- `import_2012_boulevard.ts` dosyası çalışıyor (veri indirildi)
- Sadece resim scriptlerinde hata var
- Toplam 15 dosya düzeltilmesi gerekiyor







