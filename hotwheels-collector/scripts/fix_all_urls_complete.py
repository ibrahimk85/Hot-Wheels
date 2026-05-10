#!/usr/bin/env python3
"""Complete fix for all image scripts"""

from pathlib import Path
import sys

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing All Image Scripts ===\n")

files = sorted([f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name])
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in files:
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Pattern 1: Remove type annotation
        content = content.replace('const fullCardedUrl: string = cardedImgUrl', 'const fullCardedUrl = cardedImgUrl')
        content = content.replace('const fullLooseUrl: string = looseImgUrl', 'const fullLooseUrl = looseImgUrl')
        
        # Pattern 2: Add toString() to URL constructor
        content = content.replace('new URL(fullCardedUrl);', 'new URL(fullCardedUrl.toString());')
        content = content.replace('new URL(fullLooseUrl);', 'new URL(fullLooseUrl.toString());')
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  Fixed: {file_path.name}", flush=True)
            fixed += 1
        else:
            print(f"  OK: {file_path.name}", flush=True)
    except Exception as e:
        print(f"  ERROR in {file_path.name}: {e}", file=sys.stderr, flush=True)

print(f"\n=== COMPLETE ===", flush=True)
print(f"Fixed: {fixed} files", flush=True)







