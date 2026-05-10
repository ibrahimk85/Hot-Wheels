# Fix cheerio.Element Type Error

TypeScript hatası: `cheerio.Element` tipi mevcut değil.

## Hızlı Çözüm

Terminal'de şu komutu çalıştırın:

### PowerShell (Windows):
```powershell
cd C:\Hot_Wheels\hotwheels-collector
Get-ChildItem scripts\import\import_*_boulevard.ts | ForEach-Object { (Get-Content $_.FullName -Raw) -replace 'table: cheerio\.Element', 'table: any' | Set-Content $_.FullName -NoNewline }
Get-ChildItem scripts\tools\download_and_sync_images_*_boulevard.ts | ForEach-Object { (Get-Content $_.FullName -Raw) -replace 'table: cheerio\.Element', 'table: any' | Set-Content $_.FullName -NoNewline }
```

### Veya Python script kullanın:
```bash
python scripts/fix_cheerio_types.py
```

## Açıklama

Tüm Boulevard scriptlerinde `table: cheerio.Element` tipini `table: any` olarak değiştirmeniz gerekiyor.

## Manuel Düzeltme

Her dosyada şu satırı bulun:
```typescript
function detectTableStructure($: cheerio.CheerioAPI, table: cheerio.Element) {
```

Ve şu şekilde değiştirin:
```typescript
function detectTableStructure($: cheerio.CheerioAPI, table: any) {
```

Aynı şekilde image scriptlerinde de:
```typescript
function findImageColumns($: cheerio.CheerioAPI, table: cheerio.Element) {
```

Şu şekilde:
```typescript
function findImageColumns($: cheerio.CheerioAPI, table: any) {
```







