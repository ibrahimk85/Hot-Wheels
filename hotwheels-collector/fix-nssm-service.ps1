# NSSM Service'i Duzeltme Scripti
# Bu script'i YONETICI OLARAK calistirin!

$ErrorActionPreference = "Stop"

Write-Host "NSSM Service yapilandirmasi duzeltiliyor..." -ForegroundColor Green

$serviceName = "HotWheelsDev"
$nssmPath = "C:\Program Files\nssm\nssm.exe"
$projectDir = "C:\Hot_Wheels\hotwheels-collector"

# Yonetici kontrolu
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "HATA: Bu script YONETICI OLARAK calistirilmalidir!" -ForegroundColor Red
    Write-Host "PowerShell'i sag tiklayip 'Yonetici olarak calistir' secenegini kullanin." -ForegroundColor Yellow
    exit 1
}

# Mevcut service'i durdur ve kaldir
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Mevcut service durduruluyor..." -ForegroundColor Yellow
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
    } catch {
        # Service zaten durmuş olabilir, sorun değil
    }
    Start-Sleep -Seconds 2
    
    Write-Host "Mevcut service kaldiriliyor..." -ForegroundColor Yellow
    & $nssmPath remove $serviceName confirm
    Start-Sleep -Seconds 2
}

# Node.exe yolunu bul
$nodeExe = (Get-Command node).Source
Write-Host "Node.exe bulundu: $nodeExe" -ForegroundColor Cyan

# Service'i dogru yapilandirmayla kur
Write-Host "Service kuruluyor..." -ForegroundColor Yellow

# Windows'ta next.cmd kullanmaliyiz
$nextCmdPath = Join-Path $projectDir "node_modules\.bin\next.cmd"
$cmdArgs = "/c `"$nextCmdPath`" dev"
& $nssmPath install $serviceName "C:\Windows\System32\cmd.exe" $cmdArgs
& $nssmPath set $serviceName AppDirectory $projectDir
& $nssmPath set $serviceName Description "Hot Wheels Collector Development Server"
& $nssmPath set $serviceName Start SERVICE_AUTO_START

# Log dizini olustur
$logDir = Join-Path $projectDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Host "Log dizini olusturuldu: $logDir" -ForegroundColor Cyan
}

$outputLog = Join-Path $logDir "output.log"
$errorLog = Join-Path $logDir "error.log"
& $nssmPath set $serviceName AppStdout $outputLog
& $nssmPath set $serviceName AppStderr $errorLog

# Service'i baslat
Write-Host "Service baslatiliyor..." -ForegroundColor Yellow
Start-Service -Name $serviceName

Start-Sleep -Seconds 3

# Durum kontrolu
$service = Get-Service -Name $serviceName
if ($service.Status -eq "Running") {
    Write-Host ""
    Write-Host "Service basariyla baslatildi!" -ForegroundColor Green
    Write-Host "Service adi: $serviceName" -ForegroundColor Cyan
    Write-Host "Durum: $($service.Status)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Server su adreste calisiyor olmali: http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Service baslatilamadi. Durum: $($service.Status)" -ForegroundColor Red
    Write-Host "Loglari kontrol edin: $errorLog" -ForegroundColor Yellow
    
    # Hata loglarini goster
    if (Test-Path $errorLog) {
        Write-Host ""
        Write-Host "Son hata loglari:" -ForegroundColor Yellow
        Get-Content $errorLog -Tail 10
    }
}

Write-Host ""
Write-Host "Yonetim komutlari:" -ForegroundColor Yellow
Write-Host "  Baslat:   Start-Service $serviceName" -ForegroundColor White
Write-Host "  Durdur:   Stop-Service $serviceName" -ForegroundColor White
Write-Host "  Durum:    Get-Service $serviceName" -ForegroundColor White
Write-Host "  Loglar:   Get-Content $outputLog" -ForegroundColor White
