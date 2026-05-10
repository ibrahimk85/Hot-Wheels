# Fix all cheerio.Element types to 'any' in Boulevard scripts

Write-Host "Fixing cheerio.Element types..." -ForegroundColor Cyan

# Fix import scripts
$importFiles = Get-ChildItem "scripts\import\import_*_boulevard.ts"
$count = 0
foreach ($file in $importFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'table: cheerio\.Element') {
        $content = $content -replace 'table: cheerio\.Element', 'table: any'
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "  Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    }
}
Write-Host "Fixed $count import scripts" -ForegroundColor Yellow

# Fix image scripts
$imageFiles = Get-ChildItem "scripts\tools\download_and_sync_images_*_boulevard.ts"
$count = 0
foreach ($file in $imageFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'table: cheerio\.Element') {
        $content = $content -replace 'table: cheerio\.Element', 'table: any'
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "  Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    }
}
Write-Host "Fixed $count image scripts" -ForegroundColor Yellow

Write-Host "`n=== COMPLETE ===" -ForegroundColor Green







