# NSSM ile Windows Service olarak kurulum scripti
# Bu script NSSM'i indirir ve Next.js server'ı Windows Service olarak kurar

Write-Host "NSSM (Non-Sucking Service Manager) kurulumu başlatılıyor..." -ForegroundColor Green

# NSSM indirme URL'i (en son sürüm)
$nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
$nssmZip = "$env:TEMP\nssm.zip"
$nssmDir = "$env:ProgramFiles\nssm"

# NSSM dizini yoksa oluştur
if (-not (Test-Path $nssmDir)) {
    New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
}

# NSSM zaten kurulu mu kontrol et
$nssmExe = "$nssmDir\nssm.exe"
if (-not (Test-Path $nssmExe)) {
    Write-Host "NSSM indiriliyor..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
        
        # 64-bit veya 32-bit sürümü kopyala
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        Copy-Item "$env:TEMP\nssm\nssm-2.24\$arch\nssm.exe" -Destination $nssmExe -Force
        
        Write-Host "NSSM başarıyla kuruldu!" -ForegroundColor Green
    } catch {
        Write-Host "NSSM indirme hatası: $_" -ForegroundColor Red
        Write-Host "Lütfen manuel olarak https://nssm.cc/download adresinden indirin" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "NSSM zaten kurulu." -ForegroundColor Green
}

# Mevcut servisi kaldır (varsa)
Write-Host "Mevcut servis kontrol ediliyor..." -ForegroundColor Yellow
$service = Get-Service -Name "HotWheelsDev" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Mevcut servis kaldırılıyor..." -ForegroundColor Yellow
    & $nssmExe stop "HotWheelsDev"
    & $nssmExe remove "HotWheelsDev" confirm
}

# Proje dizinini al
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = (Get-Command node).Source

Write-Host "Windows Service kuruluyor..." -ForegroundColor Yellow
Write-Host "Proje dizini: $projectDir" -ForegroundColor Cyan
Write-Host "Node.exe: $nodeExe" -ForegroundColor Cyan

# Service'i kur
& $nssmExe install "HotWheelsDev" $nodeExe "`"$projectDir\node_modules\.bin\next`" dev"
& $nssmExe set "HotWheelsDev" AppDirectory "$projectDir"
& $nssmExe set "HotWheelsDev" Description "Hot Wheels Collector Development Server"
& $nssmExe set "HotWheelsDev" Start SERVICE_AUTO_START
& $nssmExe set "HotWheelsDev" AppStdout "$projectDir\logs\output.log"
& $nssmExe set "HotWheelsDev" AppStderr "$projectDir\logs\error.log"

# Log dizini oluştur
$logDir = "$projectDir\logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Service'i başlat
Write-Host "Service başlatılıyor..." -ForegroundColor Yellow
Start-Service -Name "HotWheelsDev"

Write-Host "`nWindows Service başarıyla kuruldu!" -ForegroundColor Green
Write-Host "Service adı: HotWheelsDev" -ForegroundColor Cyan
Write-Host "`nYönetim komutları:" -ForegroundColor Yellow
Write-Host "  Başlat:   Start-Service HotWheelsDev" -ForegroundColor White
Write-Host "  Durdur:   Stop-Service HotWheelsDev" -ForegroundColor White
Write-Host "  Durum:    Get-Service HotWheelsDev" -ForegroundColor White
Write-Host "  Kaldır:   & `"$nssmExe`" remove HotWheelsDev confirm" -ForegroundColor White











