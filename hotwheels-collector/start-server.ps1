# Hot Wheels Dev Server Başlatma Scripti
# Bu script PM2'yi ayrı bir PowerShell penceresinde başlatır

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Hot Wheels Dev Server başlatılıyor..." -ForegroundColor Green

# PM2 process'lerini kontrol et
$pm2Process = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*pm2*" }

if ($pm2Process) {
    Write-Host "PM2 zaten çalışıyor." -ForegroundColor Yellow
    pm2 list
} else {
    Write-Host "PM2 başlatılıyor..." -ForegroundColor Yellow
    
    # PM2'yi yeni bir PowerShell penceresinde başlat
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; pm2 start ecosystem.config.js; pm2 logs hotwheels-dev" -WindowStyle Normal
    
    Write-Host "PM2 yeni bir pencerede başlatıldı." -ForegroundColor Green
    Write-Host "Bu pencereyi kapatmayın - server bu pencerede çalışacak." -ForegroundColor Yellow
}

Write-Host "`nServer durumunu kontrol etmek için: pm2 list" -ForegroundColor Cyan
Write-Host "Logları görmek için: pm2 logs hotwheels-dev" -ForegroundColor Cyan











