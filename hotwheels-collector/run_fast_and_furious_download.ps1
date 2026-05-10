# Fast & Furious 2023 Image Download Script
# This script downloads and syncs images for the 2023 Fast & Furious Series

# Navigate to the project directory
Set-Location -Path "$PSScriptRoot"

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found. Make sure your database connection is configured." -ForegroundColor Yellow
}

# Run the TypeScript script using ts-node
Write-Host "Starting Fast & Furious 2023 image download script..." -ForegroundColor Green
Write-Host ""

# Use ts-node with CommonJS to avoid module warnings
npx ts-node --project tsconfig.scripts.json scripts/tools/download_and_sync_images_2023_fast_and_furious.ts

# Check if the command was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Script completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
