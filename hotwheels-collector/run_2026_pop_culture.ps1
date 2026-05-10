# Pop Culture 2026 - Import and Image Download
# Same as 2025 structure

Set-Location -Path "$PSScriptRoot"

if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found." -ForegroundColor Yellow
}

Write-Host "=== Step 1: Import 2026 Pop Culture data ===" -ForegroundColor Cyan
npx ts-node scripts/import/import_2026_pop_culture.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "Import failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=== Step 2: Download 2026 Pop Culture images ===" -ForegroundColor Cyan
npx ts-node scripts/tools/download_and_sync_images_2026_pop_culture.ts
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "2026 Pop Culture setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Image download failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
