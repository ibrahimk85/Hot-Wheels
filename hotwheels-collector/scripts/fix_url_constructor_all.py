#!/usr/bin/env python3
"""Fix URL constructor in all Boulevard image scripts"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing URL Constructor Issues ===\n")

files = list(tools_dir.glob("download_and_sync_images_*_boulevard.ts"))
# Exclude template
files = [f for f in files if 'template' not in f.name]

print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in files:
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Fix 1: Add explicit type annotation (handle multiline)
    if 'let fullCardedUrl = cardedImgUrl' in content:
        content = content.replace(
            'let fullCardedUrl = cardedImgUrl',
            'let fullCardedUrl: string = cardedImgUrl'
        )
    
    if 'let fullLooseUrl = looseImgUrl' in content:
        content = content.replace(
            'let fullLooseUrl = looseImgUrl',
            'let fullLooseUrl: string = looseImgUrl'
        )
    
    # Fix 2: Remove 'as string' assertion
    content = content.replace(
        'new URL(fullCardedUrl as string)',
        'new URL(fullCardedUrl)'
    )
    content = content.replace(
        'new URL(fullLooseUrl as string)',
        'new URL(fullLooseUrl)'
    )
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed_count += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed_count} files")







