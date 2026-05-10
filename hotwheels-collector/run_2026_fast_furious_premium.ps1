# Fast & Furious Premium 2026 - Import and Image Download
# 1. Import 2026 Fast & Furious Premium data from wiki
# 2. Download and sync images

Set-Location -Path "$PSScriptRoot"

if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found. Make sure your database connection is configured." -ForegroundColor Yellow
}

Write-Host "=== Step 1: Import 2026 Fast & Furious Premium data ===" -ForegroundColor Cyan
npx ts-node --project tsconfig.scripts.json scripts/import/import_2026_fast_furious_premium.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "Import failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=== Step 2: Download 2026 Fast & Furious Premium images ===" -ForegroundColor Cyan
npx ts-node --project tsconfig.scripts.json scripts/tools/download_and_sync_images_2026_fast_furious_premium.ts
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "2026 Fast & Furious Premium setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Image download failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
