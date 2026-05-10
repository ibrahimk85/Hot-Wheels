# Fix remaining image scripts

$toolsDir = "scripts\tools"
$templatePath = Join-Path $toolsDir "download_and_sync_images_boulevard_template.ts"

if (-not (Test-Path $templatePath)) {
    Write-Host "Template not found!" -ForegroundColor Red
    exit 1
}

$template = Get-Content $templatePath -Raw
$years = 2012..2026
$fixed = 0

foreach ($year in $years) {
    $content = $template -replace '2020', "$year"
    $content = $content -replace '2020_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    
    $filename = "download_and_sync_images_${year}_boulevard.ts"
    $filepath = Join-Path $toolsDir $filename
    
    Set-Content $filepath -Value $content -NoNewline
    Write-Host "Updated: $filename" -ForegroundColor Green
    $fixed++
}

Write-Host "`nUpdated $fixed files from template" -ForegroundColor Cyan







