# Fix all image scripts - Final solution using toString()

$toolsDir = "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "=== Fixing All Image Scripts ===" -ForegroundColor Cyan
Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Remove type annotation
    $content = $content -replace 'const fullCardedUrl: string = cardedImgUrl', 'const fullCardedUrl = cardedImgUrl'
    $content = $content -replace 'const fullLooseUrl: string = looseImgUrl', 'const fullLooseUrl = looseImgUrl'
    
    # Add toString() to URL constructor
    $content = $content -replace 'new URL\(fullCardedUrl\);', 'new URL(fullCardedUrl.toString());'
    $content = $content -replace 'new URL\(fullLooseUrl\);', 'new URL(fullLooseUrl.toString());'
    
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







