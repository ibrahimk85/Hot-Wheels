# Hot Wheels logo ve araba resimlerini kopyalama scripti

$assetsPath = "..\assets"
$publicPath = "public"

# Logo dosyası
$logoSource = Join-Path $assetsPath "c__Users_ibrah_AppData_Roaming_Cursor_User_workspaceStorage_72a02ed9a30ce1c6ee3eb7c830922375_images_hot-wheels-logo-8ab914fd-e46d-4e48-bd32-3696918ea038.png"
$logoDest = Join-Path $publicPath "hot-wheels-logo.png"

# Araba dosyası
$carSource = Join-Path $assetsPath "c__Users_ibrah_AppData_Roaming_Cursor_User_workspaceStorage_72a02ed9a30ce1c6ee3eb7c830922375_images_hot-wheels-car-ec0269ec-4178-40f4-b3b0-4a004c15d791.png"
$carDest = Join-Path $publicPath "hot-wheels-car.png"

Write-Host "Kopyalama işlemi başlatılıyor..."

if (Test-Path $logoSource) {
    Copy-Item $logoSource $logoDest -Force
    Write-Host "✓ Logo dosyası kopyalandı: hot-wheels-logo.png"
} else {
    Write-Host "✗ Logo dosyası bulunamadı: $logoSource"
}

if (Test-Path $carSource) {
    Copy-Item $carSource $carDest -Force
    Write-Host "✓ Araba dosyası kopyalandı: hot-wheels-car.png"
} else {
    Write-Host "✗ Araba dosyası bulunamadı: $carSource"
}

Write-Host "`nKopyalama işlemi tamamlandı!"








