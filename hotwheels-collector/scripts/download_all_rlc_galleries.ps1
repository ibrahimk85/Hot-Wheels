# RLC Gallery Resimlerini Tüm Yıllar İçin İndirme Scripti
# Tüm yılları sırayla çalıştırır

Write-Host "=== RLC Gallery Resimlerini İndirme Başlıyor ===" -ForegroundColor Green
Write-Host ""

cd hotwheels-collector

# 2025
Write-Host "2025 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2025
Write-Host ""

# 2024
Write-Host "2024 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2024
Write-Host ""

# 2023
Write-Host "2023 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2023
Write-Host ""

# 2022
Write-Host "2022 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2022
Write-Host ""

# 2021
Write-Host "2021 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2021
Write-Host ""

# 2020
Write-Host "2020 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2020
Write-Host ""

# 2019
Write-Host "2019 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2019
Write-Host ""

# 2018
Write-Host "2018 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2018
Write-Host ""

# 2017
Write-Host "2017 yılı işleniyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_rlc_gallery.ts 2017
Write-Host ""

Write-Host "=== Tüm Yıllar Tamamlandı ===" -ForegroundColor Green


