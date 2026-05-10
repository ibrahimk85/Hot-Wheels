#!/usr/bin/env python3
"""
Fix cheerio.Element type to 'any' in all Boulevard scripts
"""

import os
import re
from pathlib import Path

script_dir = Path(__file__).parent
import_dir = script_dir / "import"
tools_dir = script_dir / "tools"

print("Fixing cheerio.Element types...\n")

# Fix import scripts
print("[1/2] Fixing import scripts...")
count = 0
for file_path in import_dir.glob("import_*_boulevard.ts"):
    content = file_path.read_text(encoding='utf-8')
    if 'table: cheerio.Element' in content:
        content = content.replace('table: cheerio.Element', 'table: any')
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed {file_path.name}")
        count += 1

print(f"  Fixed {count} import scripts\n")

# Fix image download scripts
print("[2/2] Fixing image download scripts...")
count = 0
for file_path in tools_dir.glob("download_and_sync_images_*_boulevard.ts"):
    content = file_path.read_text(encoding='utf-8')
    if 'table: cheerio.Element' in content:
        content = content.replace('table: cheerio.Element', 'table: any')
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed {file_path.name}")
        count += 1

print(f"  Fixed {count} image scripts\n")
print("=== COMPLETE ===")







