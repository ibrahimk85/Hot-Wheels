# Fix all Boulevard image scripts - ONE TIME FIX

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$template = Get-Content (Join-Path $toolsDir "download_and_sync_images_boulevard_template.ts") -Raw

Write-Host "Fixing all image scripts from template..." -ForegroundColor Cyan

2012..2026 | ForEach-Object {
    $year = $_
    $content = $template -replace '2020', "$year" -replace '2020_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    $file = Join-Path $toolsDir "download_and_sync_images_${year}_boulevard.ts"
    Set-Content $file -Value $content -NoNewline
    Write-Host "  Fixed: download_and_sync_images_${year}_boulevard.ts" -ForegroundColor Green
}

Write-Host "`nAll files fixed!" -ForegroundColor Green







