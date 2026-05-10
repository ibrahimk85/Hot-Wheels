#!/bin/bash
# Fix all cheerio.Element to any in all Boulevard scripts

# Fix import scripts
for file in scripts/import/import_*_boulevard.ts; do
  sed -i 's/table: cheerio\.Element/table: any/g' "$file"
  echo "Fixed: $file"
done

# Fix image scripts  
for file in scripts/tools/download_and_sync_images_*_boulevard.ts; do
  sed -i 's/table: cheerio\.Element/table: any/g' "$file"
  echo "Fixed: $file"
done

echo "Done!"







