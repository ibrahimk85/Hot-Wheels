#!/usr/bin/env python3
"""Final fix: Remove String() wrapper from fullCardedUrl and fullLooseUrl"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Final Fix: Remove String() Wrapper ===\n")

files = sorted([f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name])
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in files:
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Fix fullCardedUrl: Remove String() wrapper and type annotation
        # Pattern: const fullCardedUrl: string = String(cardedImgUrl\n            .replace(...)\n            .replace(...));
        pattern1 = r'const fullCardedUrl: string = String\(cardedImgUrl\s+\.replace\([^)]+\)\s+\.replace\([^)]+\)\);'
        replacement1 = r'const fullCardedUrl = cardedImgUrl\n            .replace(/\\/scale-to-width-down\\/\\d+/g, \'\')\n            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, \'\');'
        content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE)
        
        # Simpler approach: direct string replacement
        content = content.replace('const fullCardedUrl: string = String(cardedImgUrl', 'const fullCardedUrl = cardedImgUrl')
        content = re.sub(r'\)\);(\s+const urlObj = new URL\(fullCardedUrl\))', r');\1', content)
        
        # Fix fullLooseUrl: Remove String() wrapper and type annotation
        content = content.replace('const fullLooseUrl: string = String(looseImgUrl', 'const fullLooseUrl = looseImgUrl')
        content = re.sub(r'\)\);(\s+const urlObj = new URL\(fullLooseUrl\))', r');\1', content)
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  ✓ Fixed: {file_path.name}")
            fixed += 1
        else:
            print(f"  - OK: {file_path.name}")
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")
        import traceback
        traceback.print_exc()

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed} files")







