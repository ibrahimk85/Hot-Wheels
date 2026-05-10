# Resim Script Hatalarını Düzeltme

## Hatalar

1. `table.find()` çalışmıyor - `$(table).find()` olmalı
2. Filter parametrelerinde tip eksik
3. URL constructor hatası

## Hızlı Düzeltme

Tüm resim scriptlerini düzeltmek için:

```powershell
cd C:\Hot_Wheels\hotwheels-collector
powershell -ExecutionPolicy Bypass -File scripts/fix_all_image_scripts.ps1
```

Veya manuel olarak her dosyada şu değişiklikleri yapın:

### 1. Satır 106:
```typescript
// ÖNCE:
const rows = table.find('tbody tr').filter((_, row) => {

// SONRA:
const rows = $(table).find('tbody tr').filter((_: any, row: any) => {
```

### 2. Satır 210:
```typescript
// ÖNCE:
const urlObj = new URL(fullCardedUrl);

// SONRA:
const urlObj = new URL(fullCardedUrl as string);
```

### 3. Satır 264:
```typescript
// ÖNCE:
const urlObj = new URL(fullLooseUrl);

// SONRA:
const urlObj = new URL(fullLooseUrl as string);
```

## Not

Template dosyası düzeltildi, ancak oluşturulmuş dosyalar eski versiyonda olabilir. Yukarıdaki PowerShell scriptini çalıştırın veya template'ten yeniden oluşturun.







