# Final fix for URL constructor issue - Use String() wrapper

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "=== Fixing URL Constructor with String() wrapper ===" -ForegroundColor Cyan
Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Fix cardedImgUrl: Add String() conversion and fix URL constructor
    $content = $content -replace '(\s+)(if \(cardedImgUrl\) \{)', '$1cardedImgUrl = String(cardedImgUrl);$2'
    $content = $content -replace '(\s+)let fullCardedUrl: string = cardedImgUrl', '$1const fullCardedUrl = cardedImgUrl'
    $content = $content -replace '(\s+)let fullCardedUrl = cardedImgUrl', '$1const fullCardedUrl = cardedImgUrl'
    $content = $content -replace 'new URL\(fullCardedUrl\);', 'new URL(String(fullCardedUrl));'
    
    # Fix looseImgUrl: Add String() conversion and fix URL constructor
    $content = $content -replace '(\s+)(if \(looseImgUrl\) \{)', '$1looseImgUrl = String(looseImgUrl);$2'
    $content = $content -replace '(\s+)let fullLooseUrl: string = looseImgUrl', '$1const fullLooseUrl = looseImgUrl'
    $content = $content -replace '(\s+)let fullLooseUrl = looseImgUrl', '$1const fullLooseUrl = looseImgUrl'
    $content = $content -replace 'new URL\(fullLooseUrl\);', 'new URL(String(fullLooseUrl));'
    
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







