# NSSM ile Windows Service Kurulumu

PM2 Windows'ta Cursor kapandığında duruyor. NSSM (Non-Sucking Service Manager) kullanarak server'ı Windows Service olarak çalıştırabilirsiniz.

## Adım 1: NSSM'i İndirin ve Kurun

1. https://nssm.cc/download adresinden NSSM'i indirin
2. İndirdiğiniz zip dosyasını açın
3. `win64` klasöründeki `nssm.exe` dosyasını `C:\Program Files\nssm\` klasörüne kopyalayın
   - Klasör yoksa oluşturun
   - Yönetici yetkisi gerekebilir

## Adım 2: Service'i Kurun

PowerShell'i **Yönetici olarak** açın ve şu komutları çalıştırın:

```powershell
cd C:\Hot_Wheels\hotwheels-collector

# Node.exe yolunu bul
$nodeExe = (Get-Command node).Source

# Service'i kur
& "C:\Program Files\nssm\nssm.exe" install "HotWheelsDev" $nodeExe "`"$PWD\node_modules\.bin\next`" dev"
& "C:\Program Files\nssm\nssm.exe" set "HotWheelsDev" AppDirectory "$PWD"
& "C:\Program Files\nssm\nssm.exe" set "HotWheelsDev" Description "Hot Wheels Collector Development Server"
& "C:\Program Files\nssm\nssm.exe" set "HotWheelsDev" Start SERVICE_AUTO_START

# Log dizini oluştur
New-Item -ItemType Directory -Path "$PWD\logs" -Force | Out-Null
& "C:\Program Files\nssm\nssm.exe" set "HotWheelsDev" AppStdout "$PWD\logs\output.log"
& "C:\Program Files\nssm\nssm.exe" set "HotWheelsDev" AppStderr "$PWD\logs\error.log"

# Service'i başlat
Start-Service -Name "HotWheelsDev"
```

## Adım 3: Service Yönetimi

```powershell
# Service'i başlat
Start-Service HotWheelsDev

# Service'i durdur
Stop-Service HotWheelsDev

# Service durumunu kontrol et
Get-Service HotWheelsDev

# Service'i kaldır
& "C:\Program Files\nssm\nssm.exe" remove HotWheelsDev confirm
```

## Alternatif: Basit Başlatma Scripti

Eğer NSSM kurmak istemiyorsanız, `start-server.ps1` scriptini kullanabilirsiniz. 
Bu script PM2'yi ayrı bir PowerShell penceresinde başlatır. 
**Önemli:** Bu pencereyi açık tutmanız gerekir!

```powershell
.\start-server.ps1
```











