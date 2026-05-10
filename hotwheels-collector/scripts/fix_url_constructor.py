#!/usr/bin/env python3
"""Fix URL constructor in all Boulevard image scripts"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("Fixing URL constructor in image scripts...\n")

files = list(tools_dir.glob("download_and_sync_images_*_boulevard.ts"))
print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in files:
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Fix 1: Add explicit type annotation and remove 'as string'
    content = re.sub(
        r'let fullCardedUrl = cardedImgUrl',
        'let fullCardedUrl: string = cardedImgUrl',
        content
    )
    content = re.sub(
        r'let fullLooseUrl = looseImgUrl',
        'let fullLooseUrl: string = looseImgUrl',
        content
    )
    content = re.sub(
        r'new URL\(fullCardedUrl as string\)',
        'new URL(fullCardedUrl)',
        content
    )
    content = re.sub(
        r'new URL\(fullLooseUrl as string\)',
        'new URL(fullLooseUrl)',
        content
    )
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed_count += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\nFixed {fixed_count} files")







