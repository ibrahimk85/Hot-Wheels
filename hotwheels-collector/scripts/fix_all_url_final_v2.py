#!/usr/bin/env python3
"""Fix URL constructor in all image scripts - Final version"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing All Image Scripts ===\n")

files = list(tools_dir.glob("download_and_sync_images_*_boulevard.ts"))
files = [f for f in files if 'template' not in f.name]

print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in sorted(files):
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Fix: Add type annotation and remove String() wrapper
    # Pattern: const fullCardedUrl = ... -> const fullCardedUrl: string = ...
    content = re.sub(
        r'const fullCardedUrl = cardedImgUrl',
        'const fullCardedUrl: string = cardedImgUrl',
        content
    )
    content = re.sub(
        r'const fullLooseUrl = looseImgUrl',
        'const fullLooseUrl: string = looseImgUrl',
        content
    )
    
    # Remove String() wrapper from URL constructor
    content = content.replace('new URL(String(fullCardedUrl))', 'new URL(fullCardedUrl)')
    content = content.replace('new URL(String(fullLooseUrl))', 'new URL(fullLooseUrl)')
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed_count += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed_count} files")







