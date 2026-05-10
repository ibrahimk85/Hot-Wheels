# Test Komutları

## 1. Migration Scriptini Çalıştır

Veritabanına yeni alanları eklemek için:

```powershell
cd C:\Hot_Wheels\hotwheels-collector
node scripts/tools/apply_model_metadata_migration.js
```

## 2. Veritabanını Senkronize Et

```powershell
npx prisma db push --accept-data-loss --skip-generate
```

## 3. Prisma Client'ı Yeniden Generate Et

```powershell
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
npx prisma generate
```

## 4. Boulevard Import Scriptini Test Et

```powershell
npx ts-node scripts/import/import_2025_boulevard.ts
```

## 5. Boulevard Image Download Scriptini Test Et

```powershell
npx ts-node scripts/tools/download_and_sync_images_2025_boulevard.ts
```

## 6. TypeScript Derlemesini Kontrol Et

```powershell
npx tsc --noEmit scripts/import/import_2025_boulevard.ts
npx tsc --noEmit scripts/tools/download_and_sync_images_2025_boulevard.ts
```

## 7. Veritabanındaki Alanları Kontrol Et

```powershell
node -e "const Database = require('better-sqlite3'); const db = new Database('./prisma/dev.db'); try { const result = db.prepare('PRAGMA table_info(Model)').all(); console.log('Model table columns:'); result.forEach(col => console.log('  -', col.name)); } catch(e) { console.log('Error:', e.message); } finally { db.close(); }"
```

## 8. Tüm Adımları Tek Seferde Çalıştır

```powershell
cd C:\Hot_Wheels\hotwheels-collector
node scripts/tools/apply_model_metadata_migration.js
npx prisma db push --accept-data-loss --skip-generate
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
npx prisma generate
```

## Notlar

- Migration scripti idempotent'tir (aynı scripti birden fazla çalıştırabilirsiniz)
- Eğer alanlar zaten varsa, script bunları atlayacaktır
- Scriptler TypeScript hatası olmadan derlenmelidir
- Runtime'da Prisma yeni alanları kabul edecektir





