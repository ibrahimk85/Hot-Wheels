#!/usr/bin/env python3
"""Fix URL constructor issues in all Boulevard image scripts"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing URL Constructor Issues ===\n")

files = [f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name]
print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in sorted(files):
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        changes = []
        
        # Fix 1: Add explicit type annotation
        if 'let fullCardedUrl = cardedImgUrl' in content:
            content = content.replace('let fullCardedUrl = cardedImgUrl', 'let fullCardedUrl: string = cardedImgUrl')
            changes.append("fullCardedUrl type")
        
        if 'let fullLooseUrl = looseImgUrl' in content:
            content = content.replace('let fullLooseUrl = looseImgUrl', 'let fullLooseUrl: string = looseImgUrl')
            changes.append("fullLooseUrl type")
        
        # Fix 2: Remove 'as string' assertion
        if 'new URL(fullCardedUrl as string)' in content:
            content = content.replace('new URL(fullCardedUrl as string)', 'new URL(fullCardedUrl)')
            changes.append("fullCardedUrl URL")
        
        if 'new URL(fullLooseUrl as string)' in content:
            content = content.replace('new URL(fullLooseUrl as string)', 'new URL(fullLooseUrl)')
            changes.append("fullLooseUrl URL")
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  ✓ Fixed {file_path.name}: {', '.join(changes)}")
            fixed_count += 1
        else:
            print(f"  - OK: {file_path.name}")
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed_count} files")







