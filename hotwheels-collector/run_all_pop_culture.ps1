# Pop Culture - Tüm Yıllar İçin Veri ve Resim Scriptlerini Çalıştır
# Yıllar: 2013, 2014, 2015, 2016, 2017, 2024, 2025, 2026

Write-Host "=== POP CULTURE - TÜM YILLAR BAŞLATILIYOR ===" -ForegroundColor Green
Write-Host ""

# 2013
Write-Host "--- 2013 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2013_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2013 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2013_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2013 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2013 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2014
Write-Host "--- 2014 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2014_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2014 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2014_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2014 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2014 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2015
Write-Host "--- 2015 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2015_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2015 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2015_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2015 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2015 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2016
Write-Host "--- 2016 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2016_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2016 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2016_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2016 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2016 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2017
Write-Host "--- 2017 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2017_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2017 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2017_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2017 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2017 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2024
Write-Host "--- 2024 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2024_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2024 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2024_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2024 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2024 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2025
Write-Host "--- 2025 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2025_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2025 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2025_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2025 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2025 tamamlandı!" -ForegroundColor Green
Write-Host ""

# 2026
Write-Host "--- 2026 YILI ---" -ForegroundColor Yellow
Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
npx ts-node scripts/import/import_2026_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2026 veri import hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2026_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "2026 resim indirme hatası!" -ForegroundColor Red
    exit 1
}
Write-Host "2026 tamamlandı!" -ForegroundColor Green
Write-Host ""

Write-Host "=== TÜM POP CULTURE YILLARI TAMAMLANDI ===" -ForegroundColor Green




