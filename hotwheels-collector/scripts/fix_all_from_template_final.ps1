# Recreate all image scripts from template - FIXED PATH

$rootDir = "C:\Hot_Wheels\hotwheels-collector"
$toolsDir = Join-Path $rootDir "scripts\tools"
$templatePath = Join-Path $toolsDir "download_and_sync_images_boulevard_template.ts"

Write-Host "=== Recreating All Image Scripts from Template ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $templatePath)) {
    Write-Host "ERROR: Template not found at $templatePath" -ForegroundColor Red
    exit 1
}

$template = Get-Content $templatePath -Raw -Encoding UTF8

2012..2026 | ForEach-Object {
    $year = $_
    $content = $template -replace '2020', "$year" -replace '2020_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    
    $filename = "download_and_sync_images_${year}_boulevard.ts"
    $filepath = Join-Path $toolsDir $filename
    
    [System.IO.File]::WriteAllText($filepath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  ✓ Recreated: $filename" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "All 15 files recreated from template" -ForegroundColor Yellow







