# Fix all files: Copy from 2012 template with correct year replacement

$sourcePath = "scripts\tools\download_and_sync_images_2012_boulevard.ts"
$sourceContent = [System.IO.File]::ReadAllText($sourcePath, [System.Text.Encoding]::UTF8)

$years = @(2013..2019) + @(2021..2026)

Write-Host "=== Fixing All Image Scripts ===" -ForegroundColor Cyan
Write-Host "Source: $sourcePath" -ForegroundColor Gray
Write-Host "Years to fix: $($years -join ', ')" -ForegroundColor Gray
Write-Host ""

foreach ($year in $years) {
    $targetPath = "scripts\tools\download_and_sync_images_${year}_boulevard.ts"
    
    $content = $sourceContent -replace 'const targetYear = 2012;', "const targetYear = $year;" `
                              -replace '2012_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    
    [System.IO.File]::WriteAllText($targetPath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  Fixed: $year" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Fixed $($years.Count) files" -ForegroundColor Yellow







