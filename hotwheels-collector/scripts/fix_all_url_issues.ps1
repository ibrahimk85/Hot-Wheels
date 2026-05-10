# Fix URL constructor issues in all Boulevard image scripts

Write-Host "Fixing URL constructor issues..." -ForegroundColor Cyan
Write-Host ""

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts"

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Fix 1: Add explicit type annotation
    $content = $content -replace 'let fullCardedUrl = cardedImgUrl', 'let fullCardedUrl: string = cardedImgUrl'
    $content = $content -replace 'let fullLooseUrl = looseImgUrl', 'let fullLooseUrl: string = looseImgUrl'
    
    # Fix 2: Remove 'as string' assertion (not needed with explicit type)
    $content = $content -replace 'new URL\(fullCardedUrl as string\)', 'new URL(fullCardedUrl)'
    $content = $content -replace 'new URL\(fullLooseUrl as string\)', 'new URL(fullLooseUrl)'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host ""
Write-Host "Fixed $count files" -ForegroundColor Green







