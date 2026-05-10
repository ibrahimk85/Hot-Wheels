# Tüm Resim Scriptlerini Düzeltme - DOĞRU YOL

## ⚠️ Sorun

PowerShell komutunda dosya yolu yanlıştı. `hotwheels-collector` klasörü eksikti.

## ✅ Çözüm

`hotwheels-collector` klasörüne gidip şu komutu çalıştırın:

```powershell
cd C:\Hot_Wheels\hotwheels-collector
powershell -ExecutionPolicy Bypass -File scripts/FIX_IMAGES_CORRECT_PATH.ps1
```

VEYA doğrudan PowerShell komutunu çalıştırın:

```powershell
cd C:\Hot_Wheels\hotwheels-collector

$toolsDir = "scripts\tools"
$template = Get-Content "$toolsDir\download_and_sync_images_boulevard_template.ts" -Raw -Encoding UTF8

2012..2026 | ForEach-Object {
    $year = $_
    $content = $template -replace '2020', "$year" -replace '2020_Hot_Wheels_Boulevard', "${year}_Hot_Wheels_Boulevard"
    $file = "$toolsDir\download_and_sync_images_${year}_boulevard.ts"
    [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
    Write-Host "✓ Updated: $year"
}

Write-Host "`nAll files updated!" -ForegroundColor Green
```

VEYA Python script kullanın:

```bash
cd C:\Hot_Wheels\hotwheels-collector
python scripts/recreate_all_images.py
```

## 📝 Önemli

**Çalışma dizini `hotwheels-collector` olmalı!** 

Yukarıdaki komutlardan birini çalıştırdıktan sonra tüm 15 dosya template'ten yeniden oluşturulacak ve URL constructor hatası düzeltilecek.







