# Hot Wheels Server Kurulum ve Başlatma Scripti
# Bu script'i YONETICI OLARAK calistirin!

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Hot Wheels Server Kurulum ve Baslatma" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$serviceName = "HotWheelsDev"
$nssmPath = "C:\Program Files\nssm\nssm.exe"
$projectDir = "C:\Hot_Wheels\hotwheels-collector"

# Yonetici kontrolu
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "HATA: Bu script YONETICI OLARAK calistirilmalidir!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Lutfen PowerShell'i sag tiklayip 'Yonetici olarak calistir' secenegini kullanin." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatif olarak, script'i yonetici olarak acmak icin:" -ForegroundColor Cyan
    Write-Host "  Start-Process powershell -Verb RunAs -ArgumentList '-File', '$PSCommandPath'" -ForegroundColor White
    Write-Host ""
    exit 1
}

# NSSM kontrolu
if (-not (Test-Path $nssmPath)) {
    Write-Host "HATA: NSSM bulunamadi!" -ForegroundColor Red
    Write-Host "Lutfen once NSSM'i kurun: .\setup-windows-service.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "NSSM bulundu: $nssmPath" -ForegroundColor Green
Write-Host "Proje dizini: $projectDir" -ForegroundColor Cyan
Write-Host ""

# Mevcut service'i kontrol et
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Mevcut servis bulundu. Durum: $($service.Status)" -ForegroundColor Yellow
    
    if ($service.Status -eq "Running") {
        Write-Host "Servis durduruluyor..." -ForegroundColor Yellow
        try {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
            Start-Sleep -Seconds 2
            Write-Host "Servis durduruldu." -ForegroundColor Green
        } catch {
            Write-Host "Servis durdurulurken hata: $_" -ForegroundColor Red
        }
    }
    
    Write-Host "Mevcut servis kaldiriliyor..." -ForegroundColor Yellow
    try {
        & $nssmPath remove $serviceName confirm
        Start-Sleep -Seconds 2
        Write-Host "Eski servis kaldirildi." -ForegroundColor Green
    } catch {
        Write-Host "Servis kaldirilirken hata: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Mevcut servis bulunamadi, yeni servis kurulacak." -ForegroundColor Cyan
}

# Node.exe yolunu bul
try {
    $nodeExe = (Get-Command node).Source
    Write-Host "Node.exe bulundu: $nodeExe" -ForegroundColor Green
} catch {
    Write-Host "HATA: Node.js bulunamadi!" -ForegroundColor Red
    Write-Host "Lutfen Node.js'in kurulu oldugundan emin olun." -ForegroundColor Yellow
    exit 1
}

# Next.cmd yolunu kontrol et
$nextCmdPath = Join-Path $projectDir "node_modules\.bin\next.cmd"
if (-not (Test-Path $nextCmdPath)) {
    Write-Host "HATA: next.cmd bulunamadi: $nextCmdPath" -ForegroundColor Red
    Write-Host "Lutfen once 'npm install' komutunu calistirin." -ForegroundColor Yellow
    exit 1
}

Write-Host "Next.cmd bulundu: $nextCmdPath" -ForegroundColor Green
Write-Host ""

# Service'i dogru yapilandirmayla kur
Write-Host "Servis kuruluyor..." -ForegroundColor Yellow

$cmdArgs = "/c `"$nextCmdPath`" dev"
Write-Host "Komut: cmd.exe $cmdArgs" -ForegroundColor Cyan

try {
    & $nssmPath install $serviceName "C:\Windows\System32\cmd.exe" $cmdArgs
    if ($LASTEXITCODE -ne 0) {
        throw "NSSM install komutu basarisiz oldu"
    }
    Write-Host "Servis kuruldu." -ForegroundColor Green
} catch {
    Write-Host "HATA: Servis kurulurken hata: $_" -ForegroundColor Red
    exit 1
}

# Servis ayarlari
Write-Host "Servis ayarlari yapilaniyor..." -ForegroundColor Yellow

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

Write-Host "Log dosyalari:" -ForegroundColor Cyan
Write-Host "  Output: $outputLog" -ForegroundColor White
Write-Host "  Error:  $errorLog" -ForegroundColor White
Write-Host ""

# Service'i baslat
Write-Host "Servis baslatiliyor..." -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName
    Start-Sleep -Seconds 5
    
    # Durum kontrolu
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq "Running") {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Servis basariyla baslatildi!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Service adi: $serviceName" -ForegroundColor Cyan
        Write-Host "Durum: $($service.Status)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Server su adreste calisiyor: http://localhost:3000" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "UYARI: Servis baslatildi ama durum: $($service.Status)" -ForegroundColor Yellow
        Write-Host "Bir kac saniye bekleyip tekrar kontrol edin." -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "HATA: Servis baslatilamadi: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Hata loglarini kontrol edin: $errorLog" -ForegroundColor Yellow
    
    # Hata loglarini goster
    if (Test-Path $errorLog) {
        Write-Host ""
        Write-Host "Son hata loglari:" -ForegroundColor Yellow
        Get-Content $errorLog -Tail 20
    }
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Yonetim Komutlari" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Baslat:   Start-Service $serviceName" -ForegroundColor White
Write-Host "  Durdur:   Stop-Service $serviceName" -ForegroundColor White
Write-Host "  Durum:    Get-Service $serviceName" -ForegroundColor White
Write-Host "  Loglar:   Get-Content `"$outputLog`" -Tail 50" -ForegroundColor White
Write-Host "  Hatalar:  Get-Content `"$errorLog`" -Tail 50" -ForegroundColor White
Write-Host ""









