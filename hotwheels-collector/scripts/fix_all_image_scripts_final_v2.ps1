# Fix all Boulevard image download scripts - Final v2

Write-Host "=== Fixing All Image Scripts ===" -ForegroundColor Cyan
Write-Host ""

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" -Exclude "*template*"

Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$count = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Fix 1: Add explicit type annotation
    $content = $content -replace '(\s+)let fullCardedUrl = cardedImgUrl', '$1let fullCardedUrl: string = cardedImgUrl'
    $content = $content -replace '(\s+)let fullLooseUrl = looseImgUrl', '$1let fullLooseUrl: string = looseImgUrl'
    
    # Fix 2: Remove 'as string' assertion
    $content = $content -replace 'new URL\(fullCardedUrl as string\)', 'new URL(fullCardedUrl)'
    $content = $content -replace 'new URL\(fullLooseUrl as string\)', 'new URL(fullLooseUrl)'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    } else {
        Write-Host "  - OK: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Fixed: $count files" -ForegroundColor Yellow







