# Final fix: Copy fixed pattern from 2012 to all other years

$fixedSource = [System.IO.File]::ReadAllText("scripts\tools\download_and_sync_images_2012_boulevard.ts", [System.Text.Encoding]::UTF8)

$cardedFix = @"
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

$looseFix = @"
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

$files = @(2013..2026) + @(2020)

foreach ($year in $files) {
    $filePath = "scripts\tools\download_and_sync_images_${year}_boulevard.ts"
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $original = $content
        
        $content = $content -replace [regex]::Escape($oldCarded), $cardedFix
        $content = $content -replace [regex]::Escape($oldLoose), $looseFix
        
        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed: $year" -ForegroundColor Green
        } else {
            Write-Host "OK: $year" -ForegroundColor Gray
        }
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan







