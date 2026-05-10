# .env dosyasına gerekli değişkenleri ekleme scripti

$envFile = ".env"
$envPath = Join-Path $PSScriptRoot $envFile

# .env dosyası yoksa oluştur
if (-not (Test-Path $envPath)) {
    New-Item -Path $envPath -ItemType File | Out-Null
    Write-Host ".env dosyasi olusturuldu." -ForegroundColor Green
}

# Mevcut içeriği oku
$content = if (Test-Path $envPath) { Get-Content $envPath -Raw } else { "" }

# NEXTAUTH_SECRET oluştur (32 karakterlik random string)
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$secret = -join ((1..32) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

# Kontrol et ve ekle
$linesToAdd = @()

# DATABASE_URL kontrolü
if ($content -notmatch "DATABASE_URL") {
    $linesToAdd += "DATABASE_URL=`"file:./dev.db`""
}

# NEXTAUTH_SECRET kontrolü
if ($content -notmatch "NEXTAUTH_SECRET") {
    $linesToAdd += "NEXTAUTH_SECRET=$secret"
    Write-Host "NEXTAUTH_SECRET eklendi: $secret" -ForegroundColor Yellow
} else {
    Write-Host "NEXTAUTH_SECRET zaten mevcut, degistirilmedi." -ForegroundColor Cyan
}

# NEXTAUTH_URL kontrolü
if ($content -notmatch "NEXTAUTH_URL") {
    $linesToAdd += "NEXTAUTH_URL=http://localhost:3000"
}

# Yeni satırları ekle
if ($linesToAdd.Count -gt 0) {
    $newContent = if ($content -and -not $content.EndsWith("`n")) { "$content`n" } else { $content }
    $newContent += "`n# NextAuth Configuration`n"
    $newContent += ($linesToAdd -join "`n") + "`n"
    
    Set-Content -Path $envPath -Value $newContent -NoNewline
    Write-Host "`n.env dosyasi guncellendi!" -ForegroundColor Green
    Write-Host "Eklenen degiskenler:" -ForegroundColor Cyan
    $linesToAdd | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
} else {
    Write-Host "`nTum gerekli degiskenler zaten mevcut." -ForegroundColor Green
}

Write-Host "`n.env dosyasi konumu: $envPath" -ForegroundColor Cyan


