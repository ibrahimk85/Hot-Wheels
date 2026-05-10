# Fix all files: Remove String() wrapper from fullCardedUrl and fullLooseUrl

$toolsDir = "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "=== Removing String() Wrapper ===" -ForegroundColor Cyan
Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Remove String() wrapper from fullCardedUrl
    $content = $content -replace 'const fullCardedUrl: string = String\(cardedImgUrl', 'const fullCardedUrl = cardedImgUrl'
    $content = $content -replace '\)\);', '');'
    
    # Remove String() wrapper from fullLooseUrl
    $content = $content -replace 'const fullLooseUrl: string = String\(looseImgUrl', 'const fullLooseUrl = looseImgUrl'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  Fixed: $($file.Name)" -ForegroundColor Green
        $fixedCount++
    } else {
        Write-Host "  OK: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Fixed: $fixedCount files" -ForegroundColor Yellow







