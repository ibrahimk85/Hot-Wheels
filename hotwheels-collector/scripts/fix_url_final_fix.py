#!/usr/bin/env python3
"""Final fix: Use toString() for URL constructor"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Final URL Constructor Fix ===\n")

files = [f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name]
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in sorted(files):
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Remove type annotation and add .toString()
    content = content.replace('const fullCardedUrl: string = cardedImgUrl', 'const fullCardedUrl = cardedImgUrl')
    content = content.replace('const fullLooseUrl: string = looseImgUrl', 'const fullLooseUrl = looseImgUrl')
    
    # Add .toString() to URL constructor
    content = content.replace('new URL(fullCardedUrl);', 'new URL(fullCardedUrl.toString());')
    content = content.replace('new URL(fullLooseUrl);', 'new URL(fullLooseUrl.toString());')
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed} files")







