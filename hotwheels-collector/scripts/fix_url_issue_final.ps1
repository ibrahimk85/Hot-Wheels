# Fix URL constructor issue in all image scripts - Final working version

$toolsDir = "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "=== Fixing URL Constructor Issue ===" -ForegroundColor Cyan
Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Fix 1: Add type annotation
    $content = $content -replace 'const fullCardedUrl = cardedImgUrl', 'const fullCardedUrl: string = cardedImgUrl'
    $content = $content -replace 'const fullLooseUrl = looseImgUrl', 'const fullLooseUrl: string = looseImgUrl'
    
    # Fix 2: Remove String() wrapper
    $content = $content -replace 'new URL\(String\(fullCardedUrl\)\)', 'new URL(fullCardedUrl)'
    $content = $content -replace 'new URL\(String\(fullLooseUrl\)\)', 'new URL(fullLooseUrl)'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
        $fixedCount++
    } else {
        Write-Host "  - OK: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Fixed: $fixedCount files" -ForegroundColor Yellow







