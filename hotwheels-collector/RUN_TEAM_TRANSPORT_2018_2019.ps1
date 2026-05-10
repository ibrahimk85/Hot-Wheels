# Team Transport 2018-2019 Temizleme, Import ve Resim İndirme Script'leri
# Çalıştırma Sırası:
# 1. Temizleme (veritabanı ve resimler)
# 2. 2018 veri import
# 3. 2018 resim indirme
# 4. 2019 veri import
# 5. 2019 resim indirme

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Team Transport 2018-2019 İşlemleri" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 0. Temizleme
Write-Host "[0/5] Mevcut Team Transport 2018-2019 verileri ve resimleri temizleniyor..." -ForegroundColor Yellow
Write-Host "UYARI: Bu işlem tüm Team Transport 2018-2019 verilerini ve resimlerini silecek!" -ForegroundColor Red
$confirmation = Read-Host "Devam etmek istiyor musunuz? (E/H)"
if ($confirmation -ne "E" -and $confirmation -ne "e") {
    Write-Host "İşlem iptal edildi." -ForegroundColor Yellow
    exit 0
}
npx ts-node scripts/tools/cleanup_team_transport_2018_2019.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: Temizleme başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Temizleme tamamlandı" -ForegroundColor Green
Write-Host ""

# 1. 2018 Veri Import
Write-Host "[1/5] 2018 Team Transport verileri import ediliyor..." -ForegroundColor Yellow
npx ts-node scripts/import/import_2018_team_transport.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: 2018 import başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 2018 veri import tamamlandı" -ForegroundColor Green
Write-Host ""

# 2. 2018 Resim İndirme
Write-Host "[2/5] 2018 Team Transport resimleri indiriliyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_and_sync_images_2018_team_transport.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: 2018 resim indirme başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 2018 resim indirme tamamlandı" -ForegroundColor Green
Write-Host ""

# 3. 2019 Veri Import
Write-Host "[3/5] 2019 Team Transport verileri import ediliyor..." -ForegroundColor Yellow
npx ts-node scripts/import/import_2019_team_transport.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: 2019 import başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 2019 veri import tamamlandı" -ForegroundColor Green
Write-Host ""

# 4. 2019 Resim İndirme
Write-Host "[4/5] 2019 Team Transport resimleri indiriliyor..." -ForegroundColor Yellow
npx ts-node scripts/tools/download_and_sync_images_2019_team_transport.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: 2019 resim indirme başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 2019 resim indirme tamamlandı" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tüm işlemler tamamlandı!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan


