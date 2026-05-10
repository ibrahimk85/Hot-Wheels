# Fix all Boulevard image scripts - Final working version

$ErrorActionPreference = "Continue"

Write-Host "=== Fixing All Image Scripts ===" -ForegroundColor Cyan
Write-Host ""

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Apply all fixes
    $content = $content -replace 'let fullCardedUrl = cardedImgUrl', 'let fullCardedUrl: string = cardedImgUrl'
    $content = $content -replace 'let fullLooseUrl = looseImgUrl', 'let fullLooseUrl: string = looseImgUrl'
    $content = $content -replace 'new URL\(fullCardedUrl as string\)', 'new URL(fullCardedUrl)'
    $content = $content -replace 'new URL\(fullLooseUrl as string\)', 'new URL(fullLooseUrl)'
    
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
Write-Host ""







