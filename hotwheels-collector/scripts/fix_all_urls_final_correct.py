#!/usr/bin/env python3
"""Final correct fix: Remove String() wrapper, use direct string assignment"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Final Correct Fix: Remove String() Wrapper ===\n")

files = sorted([f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name])
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in files:
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Fix carded URL: Remove String() wrapper, cardedImgUrl is already a string
        # OLD: const fullCardedUrl: string = String(cardedImgUrl.replace(...));
        # NEW: const fullCardedUrl = cardedImgUrl.replace(...);
        old_carded = """const fullCardedUrl: string = String(cardedImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, ''));"""
        
        new_carded = """const fullCardedUrl = cardedImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '');"""
        
        content = content.replace(old_carded, new_carded)
        
        # Fix loose URL: Remove String() wrapper, looseImgUrl is already a string
        old_loose = """const fullLooseUrl: string = String(looseImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, ''));"""
        
        new_loose = """const fullLooseUrl = looseImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '');"""
        
        content = content.replace(old_loose, new_loose)
        
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







