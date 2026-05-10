# Fix all Boulevard image download scripts - Final version

Write-Host "=== Fixing All Boulevard Image Scripts ===" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$toolsDir = Join-Path $rootDir "scripts\tools"

if (-not (Test-Path $toolsDir)) {
    Write-Host "Error: Tools directory not found: $toolsDir" -ForegroundColor Red
    exit 1
}

$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts"

Write-Host "Found $($files.Count) image scripts" -ForegroundColor Gray
Write-Host ""

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content
    
    # Fix 1: table.find() -> $(table).find()
    $content = $content -replace '(\s+)const rows = table\.find\(', '$1const rows = $(table).find('
    
    # Fix 2: Add type annotations to filter
    $content = $content -replace '\.filter\(\(_, row\) =>', '.filter((_: any, row: any) =>'
    
    # Fix 3: Fix URL constructor
    $content = $content -replace 'new URL\(fullCardedUrl\);', 'new URL(fullCardedUrl as string);'
    $content = $content -replace 'new URL\(fullLooseUrl\);', 'new URL(fullLooseUrl as string);'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    } else {
        Write-Host "  - Already OK: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Fixed: $count files" -ForegroundColor Yellow







