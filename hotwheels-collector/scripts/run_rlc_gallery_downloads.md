# RLC Gallery İndirme Scriptleri

## Tüm Yılları Tek Seferde Çalıştırma

Tüm yılları sırayla çalıştırmak için PowerShell scriptini kullanın:

```powershell
.\scripts\download_all_rlc_galleries.ps1
```

veya

```powershell
cd hotwheels-collector
..\scripts\download_all_rlc_galleries.ps1
```

## Yılları Tek Tek Çalıştırma

Her yıl için RLC galeri resimlerini ayrı ayrı indirmek isterseniz:

```powershell
cd hotwheels-collector

# 2025
npx ts-node scripts/tools/download_rlc_gallery.ts 2025

# 2024
npx ts-node scripts/tools/download_rlc_gallery.ts 2024

# 2023
npx ts-node scripts/tools/download_rlc_gallery.ts 2023

# 2022
npx ts-node scripts/tools/download_rlc_gallery.ts 2022

# 2021
npx ts-node scripts/tools/download_rlc_gallery.ts 2021

# 2020
npx ts-node scripts/tools/download_rlc_gallery.ts 2020

# 2019
npx ts-node scripts/tools/download_rlc_gallery.ts 2019

# 2018
npx ts-node scripts/tools/download_rlc_gallery.ts 2018

# 2017
npx ts-node scripts/tools/download_rlc_gallery.ts 2017
```

**Not:** 
- Her yıl için import scriptlerinin çalıştırılmış olması gerekiyor (Collection ve Year kayıtlarının olması için).
- Resimler artık yıl önekiyle kaydediliyor (örn: `2023-resim-adi.jpg`) böylece aynı isimli resimler çakışmıyor.

