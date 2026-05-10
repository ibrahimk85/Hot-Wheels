# Fix all Boulevard image download scripts

Write-Host "Fixing all image download scripts..." -ForegroundColor Cyan
Write-Host ""

$toolsDir = Join-Path (Get-Location) "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts"

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Fix 1: table.find() -> $(table).find()
    $content = $content -replace 'table\.find\(', '$(table).find('
    
    # Fix 2: Add type annotations to filter
    $content = $content -replace '\.filter\(\(_, row\) =>', '.filter((_: any, row: any) =>'
    
    # Fix 3: Fix URL constructor with type assertion
    $content = $content -replace 'new URL\(fullCardedUrl\);', 'new URL(fullCardedUrl as string);'
    $content = $content -replace 'new URL\(fullLooseUrl\);', 'new URL(fullLooseUrl as string);'
    
    if ($content -ne $original) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host ""
Write-Host "Fixed $count files" -ForegroundColor Green







