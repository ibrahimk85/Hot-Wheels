# Car Culture 2-Packs - 2021-2026 Yılları İçin Veri ve Resim Scriptlerini Çalıştır

Write-Host "=== CAR CULTURE 2-PACKS - TÜM YILLAR BAŞLATILIYOR ===" -ForegroundColor Green
Write-Host ""

$years = @(2021, 2022, 2023, 2024, 2025, 2026)

foreach ($year in $years) {
    Write-Host "--- $year YILI ---" -ForegroundColor Yellow
    Write-Host "Veri import ediliyor..." -ForegroundColor Cyan
    npx ts-node "scripts/import/import_$($year)_car_culture_2_packs.ts"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$year veri import hatası!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Resimler indiriliyor..." -ForegroundColor Cyan
    npx ts-node "scripts/tools/download_and_sync_images_$($year)_car_culture_2_packs.ts"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$year resim indirme hatası!" -ForegroundColor Red
        exit 1
    }
    Write-Host "$year tamamlandı!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=== CAR CULTURE 2-PACKS TÜM YILLAR TAMAMLANDI ===" -ForegroundColor Green
