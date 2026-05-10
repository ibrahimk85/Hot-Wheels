# Copy fixed 2012 file to all other years

$source = "scripts\tools\download_and_sync_images_2012_boulevard.ts"
$sourceContent = [System.IO.File]::ReadAllText($source, [System.Text.Encoding]::UTF8)

2013..2026 | ForEach-Object {
    $year = $_
    $target = "scripts\tools\download_and_sync_images_${year}_boulevard.ts"
    
    $content = $sourceContent -replace 'const targetYear = 2012;', "const targetYear = $year;" -replace '2012_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    
    [System.IO.File]::WriteAllText($target, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Updated: $year"
}

Write-Host "`nAll files updated from 2012 template!" -ForegroundColor Green







