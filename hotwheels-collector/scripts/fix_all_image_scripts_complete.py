#!/usr/bin/env python3
"""Fix all Boulevard image download scripts"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing All Boulevard Image Scripts ===\n")

files = list(tools_dir.glob("download_and_sync_images_*_boulevard.ts"))
print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in files:
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Fix 1: table.find() -> $(table).find()
    content = re.sub(r'const rows = table\.find\(', 'const rows = $(table).find(', content)
    
    # Fix 2: Add type annotations to filter
    content = re.sub(r'\.filter\(\(_, row\) =>', '.filter((_: any, row: any) =>', content)
    
    # Fix 3: Fix URL constructor
    content = re.sub(r'new URL\(fullCardedUrl\);', 'new URL(fullCardedUrl as string);', content)
    content = re.sub(r'new URL\(fullLooseUrl\);', 'new URL(fullLooseUrl as string);', content)
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed_count += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed_count} files")







