# URL Constructor Hatası Düzeltme

## ❌ Hata

```
error TS2351: This expression is not constructable.
Type 'String' has no construct signatures.
```

## ✅ Çözüm

Tüm resim scriptlerinde şu 4 değişiklik yapılmalı:

### 1. Satır ~206: fullCardedUrl tip ekle
```typescript
// ÖNCE:
let fullCardedUrl = cardedImgUrl

// SONRA:
let fullCardedUrl: string = cardedImgUrl
```

### 2. Satır ~210: fullCardedUrl URL constructor
```typescript
// ÖNCE:
const urlObj = new URL(fullCardedUrl as string);

// SONRA:
const urlObj = new URL(fullCardedUrl);
```

### 3. Satır ~260: fullLooseUrl tip ekle
```typescript
// ÖNCE:
let fullLooseUrl = looseImgUrl

// SONRA:
let fullLooseUrl: string = looseImgUrl
```

### 4. Satır ~264: fullLooseUrl URL constructor
```typescript
// ÖNCE:
const urlObj = new URL(fullLooseUrl as string);

// SONRA:
const urlObj = new URL(fullLooseUrl);
```

## 🚀 Hızlı Düzeltme

Terminal'de şu komutu çalıştırın:

```powershell
cd C:\Hot_Wheels\hotwheels-collector

# Tüm dosyaları düzelt
Get-ChildItem scripts\tools\download_and_sync_images_*_boulevard.ts | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace 'let fullCardedUrl = cardedImgUrl', 'let fullCardedUrl: string = cardedImgUrl'
    $content = $content -replace 'let fullLooseUrl = looseImgUrl', 'let fullLooseUrl: string = looseImgUrl'
    $content = $content -replace 'new URL\(fullCardedUrl as string\)', 'new URL(fullCardedUrl)'
    $content = $content -replace 'new URL\(fullLooseUrl as string\)', 'new URL(fullLooseUrl)'
    Set-Content $_.FullName -Value $content -NoNewline
    Write-Host "Fixed: $($_.Name)"
}
```

VEYA Python script kullanın:
```bash
python scripts/fix_all_url_final.py
```







