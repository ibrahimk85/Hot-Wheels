# Hot Wheels Server Yeniden Başlatma Scripti
# Bu script'i YONETICI OLARAK calistirin!

$ErrorActionPreference = "Stop"

Write-Host "Hot Wheels Server yeniden baslatiliyor..." -ForegroundColor Green

$serviceName = "HotWheelsDev"
$nssmPath = "C:\Program Files\nssm\nssm.exe"

# Yonetici kontrolu
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "HATA: Bu script YONETICI OLARAK calistirilmalidir!" -ForegroundColor Red
    Write-Host "PowerShell'i sag tiklayip 'Yonetici olarak calistir' secenegini kullanin." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatif olarak, script'i yonetici olarak acmak icin:" -ForegroundColor Cyan
    Write-Host "  Start-Process powershell -Verb RunAs -ArgumentList '-File', '$PSCommandPath'" -ForegroundColor White
    exit 1
}

# Servis durumunu kontrol et
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "HATA: '$serviceName' servisi bulunamadi!" -ForegroundColor Red
    Write-Host "Lutfen once servisi kurun: .\setup-windows-service.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Mevcut servis durumu: $($service.Status)" -ForegroundColor Cyan

# Servisi durdur
if ($service.Status -eq "Running") {
    Write-Host "Servis durduruluyor..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force
    Start-Sleep -Seconds 3
    Write-Host "Servis durduruldu." -ForegroundColor Green
} else {
    Write-Host "Servis zaten durdurulmus." -ForegroundColor Yellow
}

# Servisi baslat
Write-Host "Servis baslatiliyor..." -ForegroundColor Yellow
Start-Service -Name $serviceName
Start-Sleep -Seconds 5

# Durum kontrolu
$service = Get-Service -Name $serviceName
if ($service.Status -eq "Running") {
    Write-Host ""
    Write-Host "Servis basariyla baslatildi!" -ForegroundColor Green
    Write-Host "Service adi: $serviceName" -ForegroundColor Cyan
    Write-Host "Durum: $($service.Status)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Server su adreste calisiyor: http://localhost:3000" -ForegroundColor Green
    
    # Log dosyalarini goster
    $projectDir = "C:\Hot_Wheels\hotwheels-collector"
    $outputLog = Join-Path $projectDir "logs\output.log"
    $errorLog = Join-Path $projectDir "logs\error.log"
    
    Write-Host ""
    Write-Host "Log dosyalari:" -ForegroundColor Yellow
    Write-Host "  Output: $outputLog" -ForegroundColor White
    Write-Host "  Error:  $errorLog" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "HATA: Servis baslatilamadi. Durum: $($service.Status)" -ForegroundColor Red
    
    # Hata loglarini goster
    $projectDir = "C:\Hot_Wheels\hotwheels-collector"
    $errorLog = Join-Path $projectDir "logs\error.log"
    if (Test-Path $errorLog) {
        Write-Host ""
        Write-Host "Son hata loglari:" -ForegroundColor Yellow
        Get-Content $errorLog -Tail 20
    }
}

Write-Host ""
Write-Host "Yonetim komutlari:" -ForegroundColor Yellow
Write-Host "  Baslat:   Start-Service $serviceName" -ForegroundColor White
Write-Host "  Durdur:   Stop-Service $serviceName" -ForegroundColor White
Write-Host "  Durum:    Get-Service $serviceName" -ForegroundColor White
Write-Host "  Loglar:   Get-Content `"$projectDir\logs\output.log`"" -ForegroundColor White









