# Server Yeniden Başlatma

Windows Service olarak çalışan Hot Wheels server'ını yeniden başlatmak için:

## Yöntem 1: PowerShell Script (Önerilen)

1. PowerShell'i **Yönetici olarak** açın (sağ tık → "Yönetici olarak çalıştır")
2. Proje dizinine gidin:
   ```powershell
   cd C:\Hot_Wheels\hotwheels-collector
   ```
3. Restart scriptini çalıştırın:
   ```powershell
   .\restart-server.ps1
   ```

## Yöntem 2: Manuel Komutlar

PowerShell'i **Yönetici olarak** açın ve şu komutları çalıştırın:

```powershell
# Servisi durdur
Stop-Service -Name "HotWheelsDev"

# Servisi başlat
Start-Service -Name "HotWheelsDev"

# Durum kontrolü
Get-Service -Name "HotWheelsDev"
```

## Yöntem 3: NSSM Komutları

PowerShell'i **Yönetici olarak** açın:

```powershell
$nssmExe = "C:\Program Files\nssm\nssm.exe"

# Servisi yeniden başlat
& $nssmExe restart "HotWheelsDev"

# Durum kontrolü
& $nssmExe status "HotWheelsDev"
```

## Servis Durumunu Kontrol Etme

```powershell
# PowerShell ile
Get-Service -Name "HotWheelsDev"

# NSSM ile
& "C:\Program Files\nssm\nssm.exe" status "HotWheelsDev"
```

## Log Dosyaları

Log dosyaları şu konumda:
- Output: `C:\Hot_Wheels\hotwheels-collector\logs\output.log`
- Error: `C:\Hot_Wheels\hotwheels-collector\logs\error.log`

Logları görüntülemek için:
```powershell
# Son 50 satırı göster
Get-Content "C:\Hot_Wheels\hotwheels-collector\logs\output.log" -Tail 50

# Hata logları
Get-Content "C:\Hot_Wheels\hotwheels-collector\logs\error.log" -Tail 50
```

## Not

- Servis Windows Service olarak çalıştığı için Cursor kapansa bile çalışmaya devam eder
- Servis otomatik başlatma (SERVICE_AUTO_START) olarak ayarlanmıştır
- Bilgisayar yeniden başlatıldığında servis otomatik olarak başlar









