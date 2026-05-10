#!/usr/bin/env python3
"""Final solution: Use String() wrapper and remove .toString()"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Final URL Constructor Fix ===\n")

files = sorted([f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name])
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in files:
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Pattern 1: Wrap with String() and add type annotation, remove .toString()
        # Match: const fullCardedUrl = cardedImgUrl...replace(...); new URL(fullCardedUrl.toString());
        # Replace with: const fullCardedUrl: string = String(cardedImgUrl...replace(...)); new URL(fullCardedUrl);
        import re
        
        # Fix carded URL
        pattern1 = r'const fullCardedUrl = (cardedImgUrl\s+\.replace\([^;]+\)\s+\.replace\([^;]+\));\s*const urlObj = new URL\(fullCardedUrl\.toString\(\)\);'
        replacement1 = r'const fullCardedUrl: string = String(\1);\n          const urlObj = new URL(fullCardedUrl);'
        content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE | re.DOTALL)
        
        # Fix loose URL
        pattern2 = r'const fullLooseUrl = (looseImgUrl\s+\.replace\([^;]+\)\s+\.replace\([^;]+\));\s*const urlObj = new URL\(fullLooseUrl\.toString\(\)\);'
        replacement2 = r'const fullLooseUrl: string = String(\1);\n          const urlObj = new URL(fullLooseUrl);'
        content = re.sub(pattern2, replacement2, content, flags=re.MULTILINE | re.DOTALL)
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  ✓ Fixed: {file_path.name}")
            fixed += 1
        else:
            print(f"  - OK: {file_path.name}")
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed} files")







