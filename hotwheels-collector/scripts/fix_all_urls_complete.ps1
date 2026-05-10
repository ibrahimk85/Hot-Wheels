# Fix all Boulevard image scripts - Complete fix

$toolsDir = "scripts\tools"
$files = Get-ChildItem "$toolsDir\download_and_sync_images_*_boulevard.ts" | Where-Object { $_.Name -notlike "*template*" }

Write-Host "=== Fixing All Image Scripts ===" -ForegroundColor Cyan
Write-Host "Found $($files.Count) files" -ForegroundColor Gray
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Fix carded URL block
    $oldCarded = @"
        if (cardedImgUrl) {
          cardedImgUrl = String(cardedImgUrl);
          if (cardedImgUrl.startsWith('//')) {
            cardedImgUrl = 'https:' + cardedImgUrl;
          }
          
          const fullCardedUrl = cardedImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullCardedUrl);
"@
    
    $newCarded = @"
        if (cardedImgUrl) {
          const cardedImgUrlStr = String(cardedImgUrl);
          const processedUrl = cardedImgUrlStr.startsWith('//') 
            ? 'https:' + cardedImgUrlStr 
            : cardedImgUrlStr;
          
          const fullCardedUrl: string = processedUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '') as string;

          const urlObj = new URL(fullCardedUrl);
"@
    
    $content = $content -replace [regex]::Escape($oldCarded), $newCarded
    
    # Fix loose URL block
    $oldLoose = @"
        if (looseImgUrl) {
          looseImgUrl = String(looseImgUrl);
          if (looseImgUrl.startsWith('//')) {
            looseImgUrl = 'https:' + looseImgUrl;
          }
          
          const fullLooseUrl = looseImgUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullLooseUrl);
"@
    
    $newLoose = @"
        if (looseImgUrl) {
          const looseImgUrlStr = String(looseImgUrl);
          const processedUrl = looseImgUrlStr.startsWith('//') 
            ? 'https:' + looseImgUrlStr 
            : looseImgUrlStr;
          
          const fullLooseUrl: string = processedUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '') as string;

          const urlObj = new URL(fullLooseUrl);
"@
    
    $content = $content -replace [regex]::Escape($oldLoose), $newLoose
    
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







