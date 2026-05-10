# Tüm URL Hatalarını Düzeltme - Final Komut

## Terminal'de Çalıştırın

```powershell
cd C:\Hot_Wheels\hotwheels-collector

$files = Get-ChildItem scripts\tools\download_and_sync_images_*_boulevard.ts | Where-Object { $_.Name -notlike '*template*' }

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # Remove type annotation
    $content = $content -replace 'const fullCardedUrl: string = cardedImgUrl', 'const fullCardedUrl = cardedImgUrl'
    $content = $content -replace 'const fullLooseUrl: string = looseImgUrl', 'const fullLooseUrl = looseImgUrl'
    
    # Add toString() to URL constructor
    $content = $content -replace 'new URL\(fullCardedUrl\);', 'new URL(fullCardedUrl.toString());'
    $content = $content -replace 'new URL\(fullLooseUrl\);', 'new URL(fullLooseUrl.toString());'
    
    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed: $($file.Name)"
}

Write-Host "`nAll files fixed!" -ForegroundColor Green
```

VEYA Python script kullanın:

```bash
python scripts/fix_all_urls_complete.py
```

Bu komutlar tüm 15 dosyayı düzeltecek.







