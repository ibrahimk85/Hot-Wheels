# Fix all image scripts - CORRECT PATH VERSION

$rootDir = "C:\Hot_Wheels\hotwheels-collector"
Set-Location $rootDir

$toolsDir = Join-Path $rootDir "scripts\tools"
$templatePath = Join-Path $toolsDir "download_and_sync_images_boulevard_template.ts"

Write-Host "=== Recreating All Image Scripts ===" -ForegroundColor Cyan
Write-Host "Template: $templatePath" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $templatePath)) {
    Write-Host "ERROR: Template not found!" -ForegroundColor Red
    exit 1
}

$template = Get-Content $templatePath -Raw -Encoding UTF8
$years = 2012..2026
$count = 0

foreach ($year in $years) {
    $content = $template -replace '2020', "$year" -replace '2020_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    
    $filename = "download_and_sync_images_${year}_boulevard.ts"
    $filepath = Join-Path $toolsDir $filename
    
    [System.IO.File]::WriteAllText($filepath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  ✓ Updated: $filename" -ForegroundColor Green
    $count++
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Updated $count files" -ForegroundColor Yellow







